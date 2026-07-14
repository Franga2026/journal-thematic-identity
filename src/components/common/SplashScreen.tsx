/**
 * Pantalla mínima mientras bootstrapData() descarga los JSON grandes.
 */
export default function SplashScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'linear-gradient(160deg, #f0f6fb 0%, #e8eef4 50%, #f6f8f9 100%)',
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#14314e',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 13,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#185FA5',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
        }}
      >
        Universidad de Tarapacá
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        Directorio de investigadores
      </h1>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 14,
          color: '#5a6f82',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 320,
        }}
      >
        Cargando datos del portal…
      </p>
      <div
        aria-hidden
        style={{
          marginTop: 20,
          width: 28,
          height: 28,
          border: '2.5px solid #c5d8ea',
          borderTopColor: '#185FA5',
          borderRadius: '50%',
          animation: 'uta-splash-spin 0.7s linear infinite',
        }}
      />
      <style>{`
        @keyframes uta-splash-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
