import { useSpeckleSyncDocumentsInSelectedDrive } from "document-models/speckle-sync";
import { useMemo, useState } from "react";
import {
  resolveViewerToken,
  storedViewerToken,
  storeViewerToken,
  type ViewerTokenSource,
} from "../../shared/speckle.js";
import { Button, TextInput } from "../../shared/ui.js";

/**
 * The token the 3D viewer loads with — see resolveViewerToken for the order.
 *
 * The sync documents' local scope is read, never written: a token pasted here
 * goes to this browser's storage, keyed by server, and never into a document.
 */
export function useViewerToken(
  projectDocumentId: string,
  serverUrl: string,
): {
  token: string | null;
  source: ViewerTokenSource;
  save: (token: string) => void;
  forget: () => void;
} {
  const syncDocuments = useSpeckleSyncDocumentsInSelectedDrive();
  // Bumped on save and forget, so the stored value is read again.
  const [revision, setRevision] = useState(0);

  const resolved = useMemo(
    () =>
      resolveViewerToken({
        projectDocumentId,
        serverUrl,
        syncDocuments,
        stored: storedViewerToken(serverUrl),
      }),
    // `revision` stands for localStorage, which React cannot observe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectDocumentId, serverUrl, syncDocuments, revision],
  );

  return {
    ...resolved,
    save: (token) => {
      storeViewerToken(serverUrl, token);
      setRevision((value) => value + 1);
    },
    forget: () => {
      storeViewerToken(serverUrl, null);
      setRevision((value) => value + 1);
    },
  };
}

/** Asks for a personal access token when the project cannot be read without. */
export function TokenPrompt({
  serverUrl,
  replacing,
  onSave,
}: {
  serverUrl: string;
  /** A stored token exists but did not work. */
  replacing: boolean;
  onSave: (token: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onSave(value.trim());
        setValue("");
      }}
    >
      <p>
        {replacing
          ? "The stored token could not load this project — paste another Speckle personal access token to view it in 3D."
          : "This project is private — paste a Speckle personal access token to view it in 3D."}{" "}
        <span className="opacity-75">
          It stays in this browser, for {serverUrl} only.
        </span>
      </p>
      <div className="flex items-center gap-2">
        <TextInput
          value={value}
          onChange={setValue}
          type="password"
          placeholder="speckle PAT"
          mono
        />
        <Button type="submit" variant="secondary" disabled={!value.trim()}>
          Use token
        </Button>
      </div>
    </form>
  );
}
