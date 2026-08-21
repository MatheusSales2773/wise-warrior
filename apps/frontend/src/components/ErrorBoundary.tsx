import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary de nível de aplicação (react-expert: "implement error
 * boundaries for graceful failures"). Só componentes de classe podem ser
 * error boundaries no React atual — exceção deliberada ao padrão de hooks
 * usado no resto do app.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Erro não tratado na UI:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-display)' }}>Algo saiu do rumo</h1>
          <p>Recarregue a página. Se o problema persistir, avise a equipe.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
