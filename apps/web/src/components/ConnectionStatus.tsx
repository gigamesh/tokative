import { useExtensionStatus } from "@/hooks/useExtensionStatus";

export function ConnectionStatus() {
  const { isExtensionConnected } = useExtensionStatus();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        isExtensionConnected
          ? "bg-green-500/20 text-green-400"
          : "bg-red-500/20 text-red-400"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isExtensionConnected ? "bg-green-400" : "bg-red-400"
        }`}
      />
      {isExtensionConnected ? "Extension Connected" : "Extension Not Connected"}
    </div>
  );
}
