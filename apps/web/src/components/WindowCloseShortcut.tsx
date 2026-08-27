import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { isElectron } from "../env";
import { resolveShortcutCommand } from "../keybindings";
import { isPreviewFocused } from "../lib/previewFocus";
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
      // A shortcut recorder is spelling this keystroke, not running it.
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("[data-keybinding-capture]")
      ) {
        return;
      }
      // A terminal close confirmation holds focus outside the terminal, so the
      // `!terminalFocus` clause would otherwise match and close the window out
      // from under the dialog.
      if (isTerminalCloseConfirmPending()) return;
      // Root-mounted, so route/thread-scoped flags such as `terminalOpen` are
      // out of reach; a `window.close` rule that reads them evaluates them as
      // false, matching how other global handlers pass partial context.
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: getTerminalFocusOwner() !== null,
          previewFocus: isPreviewFocused(),
        },
      });
      if (command !== "window.close") return;
      // An older desktop shell has no `closeWindow` and still binds the native
      // accelerator, so swallowing the keystroke here would break its own close.
      const closeWindow = window.desktopBridge?.closeWindow;
      if (!closeWindow) return;
      event.preventDefault();
      event.stopPropagation();
      void closeWindow();
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [keybindings]);

  return null;
}
