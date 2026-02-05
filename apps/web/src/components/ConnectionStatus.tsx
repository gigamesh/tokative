import { useExtensionStatus } from "@/hooks/useExtensionStatus";

export function ConnectionStatus() {
  const { isExtensionConnected } = useExtensionStatus();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        isExtensionConnected
          ? "bg-accent-cyan-500/20 text-accent-cyan-solid"
          : "bg-red-500/20 text-red-400"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isExtensionConnected ? "bg-accent-cyan-solid" : "bg-red-400"
        }`}
      />
      {isExtensionConnected ? "Extension Connected" : "Extension Not Connected"}
    </div>
  );
}
