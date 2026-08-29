interface StepperProps {
  currentStep: number
  labels: string[]
}

export function Stepper({ currentStep, labels }: StepperProps) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Wizard steps">
      {labels.map((label, index) => {
        const step = index + 1
        const isCurrent = step === currentStep
        const isDone = step < currentStep
        return (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isCurrent
                ? 'bg-brand text-white'
                : isDone
                  ? 'bg-red-50 text-brand'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span>{step}</span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
