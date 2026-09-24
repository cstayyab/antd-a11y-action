import { Button } from 'antd';
import { FontAwesomeIcon } from './icons';

const faTrash = 'trash';

// jsx-a11y/control-has-associated-label on a native button with only an svg
// jsx-a11y/control-has-associated-label on a native button with only a FontAwesomeIcon (mapped to svg)
// antd-a11y/icon-button-has-name on an antd Button with only a FontAwesomeIcon
export function Native({ onRemove }: { onRemove: () => void }) {
  return (
    <div>
      <button type="button" onClick={onRemove}>
        <svg viewBox="0 0 16 16" />
      </button>
      <button type="button" onClick={onRemove}>
        <FontAwesomeIcon icon={faTrash} />
      </button>
      <Button onClick={onRemove}>
        <FontAwesomeIcon icon={faTrash} />
      </Button>
    </div>
  );
}
