import { PiWarningOctagonFill, PiWarningFill, PiInfoFill } from "react-icons/pi";

const ICONS = { high: PiWarningOctagonFill, medium: PiWarningFill, low: PiInfoFill };

// Icon + text label: severity never relies on color alone.
export default function SeverityTag({ severity }) {
  const Icon = ICONS[severity] || PiInfoFill;
  return (
    <span className={`sev-tag sev-${severity}`}>
      <Icon aria-hidden="true" />
      {severity}
    </span>
  );
}

