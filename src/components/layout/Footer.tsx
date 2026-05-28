export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">
        <div>
          <div className="footer__brand">Universidad de Tarapacá</div>
          Av. 18 de Septiembre 2222, Arica, Chile
          <br />
          Datos: Pure + OpenAlex + ORCID
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.35)' }}>
            Metadata: OpenAlex + ORCID API
          </div>
          <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.25)' }}>
            © {new Date().getFullYear()} Universidad de Tarapacá
          </div>
        </div>
      </div>
    </footer>
  );
}
