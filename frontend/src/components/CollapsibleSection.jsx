import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HiChevronDown } from "react-icons/hi2";
import "./CollapsibleSection.css";

export default function CollapsibleSection({ icon, title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`collapsible ${open ? "open" : ""}`}>
      <button className="collapsible-header" onClick={() => setOpen((o) => !o)}>
        <span className="collapsible-icon">{icon}</span>
        <span className="collapsible-title">{title}</span>
        {badge !== undefined && badge !== null && <span className="collapsible-badge">{badge}</span>}
        <motion.span
          className="collapsible-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <HiChevronDown />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="collapsible-body-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="collapsible-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
