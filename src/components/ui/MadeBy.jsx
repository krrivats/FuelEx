import Icon from './Icon.jsx';

/** Credit mark: Made by (Instagram icon) Krrivats ❤️ */
export default function MadeBy({ className = '' }) {
  return (
    <span className={`madeby ${className}`.trim()}>
      Made by <Icon name="instagram" title="Instagram" /> <strong>Krrivats</strong> <span className="madeby-heart" role="img" aria-label="love">❤️</span>
    </span>
  );
}
