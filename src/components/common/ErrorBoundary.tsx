import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__icon">⚠️</div>
          <h3 className="error-boundary__title">Algo salió mal</h3>
          <p className="error-boundary__message">
            {this.props.fallbackMessage || 'Ocurrió un error al cargar este contenido.'}
          </p>
          <button
            className="error-boundary__btn"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reintentar
          </button>
          <button
            className="error-boundary__btn"
            style={{ marginLeft: 8, background: '#475569' }}
            onClick={() => window.location.reload()}
          >
            Recargar página
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="error-boundary__detail">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
