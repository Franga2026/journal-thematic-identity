import { useState } from 'react';

export default function FwciInfoTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <span className="vb-fwci-info">
      <button
        type="button"
        className="vb-fwci-info__btn"
        aria-label="Qué es el FWCI"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
      >
        <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>ⓘ</span>
      </button>
      {open && (
        <div className="vb-fwci-info__panel" role="tooltip">
          <span className="vb-fwci-info__text">
            <strong>Field-Weighted Citation Impact:</strong> mide las citas de un
            trabajo relativas al promedio mundial de su campo, año y tipo.
          </span>
          <span className="vb-fwci-info__interp">
            <strong>Interpretación:</strong>
          </span>
          <ul className="vb-fwci-info__list">
            <li><b>1,00</b> — impacto similar al promedio mundial</li>
            <li><b>1,50</b> — 50 % sobre el valor esperado</li>
            <li><b>0,70</b> — 30 % bajo el valor esperado</li>
          </ul>
        </div>
      )}
    </span>
  );
}
