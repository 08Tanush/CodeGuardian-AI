import { motion } from "framer-motion";
import "./FeatureCard.css";

export default function FeatureCard({ icon, title, description, accent = "primary", index = 0 }) {
  return (
    <motion.div
      className={`feature-card accent-${accent}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
    >
      <div className="feature-card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </motion.div>
  );
}
