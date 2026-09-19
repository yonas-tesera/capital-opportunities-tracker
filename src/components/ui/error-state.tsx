import { LoadingButton } from "./loading-button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({ message, onRetry, retrying = false }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center">
      <h2 className="text-base font-semibold text-red-900">Something went wrong</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-red-800">{message}</p>
      {onRetry && (
        <LoadingButton variant="secondary" className="mt-4" loading={retrying} loadingText="Retrying…" onClick={onRetry}>
          Try again
        </LoadingButton>
      )}
    </div>
  );
}
