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
            trabajo relativas al promedio mundial de su campo, año y tipo. Un valor
            de 1,0 representa el promedio global.
          </span>
          <span className="vb-fwci-info__ex">
            <strong>Ejemplo:</strong> FWCI 1,8 = 80% más citas que el promedio de su
            disciplina.
          </span>
        </div>
      )}
    </span>
  );
}
