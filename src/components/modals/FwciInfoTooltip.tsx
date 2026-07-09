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
            <strong>FWCI</strong> (Field-Weighted Citation Impact): impacto de citación
            normalizado por campo, año y tipo de obra. <strong>1,0 = promedio mundial.</strong>
          </span>
          <span className="vb-fwci-info__ex">
            <strong>Ej.:</strong> FWCI 2,5 → la obra recibió 2,5× las citas esperadas para su disciplina.
          </span>
        </div>
      )}
    </span>
  );
}
