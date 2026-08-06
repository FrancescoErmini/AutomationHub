import json
from pathlib import Path

from app.ingestion.validation import DataQualityReport


def write_report(report: DataQualityReport, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{Path(report.source).stem}-report.json"
    output_path.write_text(json.dumps(report.to_dict(), indent=2) + "\n", encoding="utf-8")
    return output_path
