import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

function readIsCarioca(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("stellar-mode") === "carioca";
  } catch {
    return false;
  }
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      const pt = readIsCarioca();
      return (
        <div className="error-boundary" role="alert">
          <h2>{pt ? "Deu ruim aqui" : "Something went wrong"}</h2>
          <p>
            {pt
              ? "Aconteceu um erro inesperado. Recarrega a pagina ai."
              : "An unexpected error occurred. Please reload the page."}
          </p>
          <details>
            <summary>{pt ? "Detalhes do erro" : "Error details"}</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            {pt ? "Recarregar" : "Reload page"}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
