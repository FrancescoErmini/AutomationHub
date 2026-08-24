import { describe, expect, it } from 'vitest'

import {
  computeFeasibility,
  computeFinalClassification,
  computeRoi,
  computeTechnologyCategory,
} from './ideaScoring'

const BASE_ROI_INPUT = {
  taskFrequency: 'Daily',
  transactionVolume: 100,
  avgTimePerTaskMinutes: 10,
  errorRatePct: 5,
  avgReworkTimeMinutes: 15,
  avgLoadedFteCostEur: 40000,
}

const BASE_FEASIBILITY_INPUT = {
  processStability: 'No Change',
  systemStability: 'No Change',
  decisionLogic: '100% Rule-Based',
  processVariations: '1 Standard Path',
  systemInterface: 'API Available',
  primaryInputFormat: 'Structured Digital (Excel/DB/API)',
}

describe('computeRoi', () => {
  it('matches the same numbers as the backend scoring engine', () => {
    const result = computeRoi(BASE_ROI_INPUT)

    expect(result.annualTransactions).toBe(25000)
    expect(result.baseHours).toBe(4166.67)
    expect(result.reworkHours).toBe(312.5)
    expect(result.totalHoursSaved).toBe(4479.17)
    expect(result.grossRoiEur).toBe(89583.33)
  })
})

describe('computeFeasibility', () => {
  it('is High with no penalties', () => {
    expect(computeFeasibility(BASE_FEASIBILITY_INPUT)).toEqual({
      score: 100,
      band: 'High',
    })
  })

  it('applies every documented penalty', () => {
    const result = computeFeasibility({
      processStability: 'Major Overhaul Planned',
      systemStability: 'Platform Migration Planned',
      decisionLogic: 'Requires Subjective Judgment',
      processVariations: '6+ Custom Paths',
      systemInterface: 'Citrix/Virtual Desktop',
      primaryInputFormat: 'Physical Paper',
    })

    expect(result.score).toBe(100 - 30 - 20 - 25 - 20 - 15 - 15)
    expect(result.band).toBe('Low')
  })
})

describe('computeTechnologyCategory', () => {
  it('maps Step 7 answers to the documented categories', () => {
    expect(
      computeTechnologyCategory(
        'No (Tabular/Structured)',
        'No (Strict If/Then)',
      ),
    ).toBe('Traditional RPA')
    expect(
      computeTechnologyCategory('Yes - Standard Forms', 'No (Strict If/Then)'),
    ).toBe('RPA + AI Document Understanding')
    expect(
      computeTechnologyCategory(
        'Yes - Free Text (Emails/Contracts)',
        'No (Strict If/Then)',
      ),
    ).toBe('GenAI / Agentic (LLM + Automation)')
  })
})

describe('computeFinalClassification', () => {
  it('matches the documented table, folding Medium+Low into Deprioritize / Avoid', () => {
    expect(computeFinalClassification('High', 60000, 50000)).toBe('Quick Win')
    expect(computeFinalClassification('Medium', 60000, 50000)).toBe(
      'Strategic Investment',
    )
    expect(computeFinalClassification('High', 10000, 50000)).toBe(
      'Low-Hanging Fruit',
    )
    expect(computeFinalClassification('Low', 999999, 50000)).toBe(
      'Deprioritize / Avoid',
    )
    expect(computeFinalClassification('Medium', 10000, 50000)).toBe(
      'Deprioritize / Avoid',
    )
  })
})
