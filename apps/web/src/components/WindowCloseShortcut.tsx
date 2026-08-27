import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { isElectron } from "../env";
import { resolveShortcutCommand } from "../keybindings";
import { isTerminalCloseConfirmPending } from "../lib/terminalCloseConfirm";
import { getTerminalFocusOwner } from "../lib/terminalFocus";
import { primaryServerKeybindingsAtom } from "../state/server";

/**
 * Runs the `window.close` keybinding. Desktop only: the native menu binds no
 * CmdOrCtrl+W accelerator, so the renderer owns the shortcut there. A browser
 * tab keeps its own Ctrl+W, which a page cannot intercept anyway.
 */
export function WindowCloseShortcut() {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);

  useEffect(() => {
    if (!isElectron) return;

    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return;
      // A terminal close confirmation holds focus outside the terminal, so the
      // `!terminalFocus` clause would otherwise match and close the window out
      // from under the dialog.
      if (isTerminalCloseConfirmPending()) return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: { terminalFocus: getTerminalFocusOwner() !== null },
      });
      if (command !== "window.close") return;
      event.preventDefault();
      event.stopPropagation();
      void window.desktopBridge?.closeWindow?.();
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [keybindings]);

  return null;
}
