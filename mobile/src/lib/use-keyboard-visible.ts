import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * True while the soft keyboard is visible (iOS + Android). Used to hide
 * the floating tab bar and dock bottom composers just above the keyboard —
 * only the input area should rise; the tab bar must not ride up with the
 * Android adjustResize window shrink.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setVisible(true)
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
