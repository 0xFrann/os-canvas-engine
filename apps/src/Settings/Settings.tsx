import { ArrowLeft, Image, Languages, type LucideIcon } from "lucide-react";
import { useDesktop } from "../desktop";
import { useState } from "react";

interface OptionProps {
  /** Shown but not usable, the reference's `disabled` flag: dimmed, no hover, no action. */
  disabled?: boolean;
  icon: LucideIcon;
  /** Names this option in the DOM, the way the dock's icons name their apps. */
  id: string;
  label: string;
  onClick?: () => void;
}

/**
 * One entry of the home grid: an icon with its name under it. It is a `control`, like a dock icon:
 * same wash, same scale, same curve. Inside a window that transition is not free — every frame of
 * it is another snapshot the engine draws — and it is paid on purpose: a control that answers
 * differently depending on where it lives is not one desktop.
 */
function Option({ disabled, icon: Icon, id, label, onClick }: OptionProps) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      data-option={id}
      onClick={() => !disabled && onClick?.()}
      className="control flex flex-col items-center gap-1.5 rounded-window px-2 py-3 select-none"
    >
      <Icon className="size-8" strokeWidth={1.5} />
      <span className="text-sm leading-none">{label}</span>
    </button>
  );
}

/**
 * The reference desktop's [Settings](https://github.com/0xFrann/desktop-os-react-next/blob/main/src/components/apps/SettingsApp.tsx),
 * for what it *is*: a home of options — Background, and Language shown disabled — and a Background
 * page that picks the desktop's wallpaper. (`ActivateWallet` is in the reference's enum and never
 * rendered there, so it is not here either.) How it looks is this desktop's own: the window
 * chrome's greys, its border and radius, the dock's hover and disabled language, lucide icons.
 *
 * It is an app, so it changes nothing itself: it asks the desktop, which owns the wallpaper and
 * remembers it (ADR 004). The reference writes `.main-layout`'s style and `localStorage` from here.
 */
export function Settings() {
  const { background, backgrounds, setBackground } = useDesktop();
  const [onBackgroundPage, setOnBackgroundPage] = useState(false);

  if (!onBackgroundPage) {
    return (
      <div className="grid h-full grid-cols-3 content-start gap-2 overflow-y-auto p-4">
        <Option
          icon={Image}
          id="background"
          label="Background"
          onClick={() => setOnBackgroundPage(true)}
        />
        <Option disabled icon={Languages} id="language" label="Language" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b-2 border-window-border px-3 py-2 select-none">
        <button
          type="button"
          aria-label="Back"
          onClick={() => setOnBackgroundPage(false)}
          className="control -m-1 flex size-7 items-center justify-center rounded-full"
        >
          <ArrowLeft className="size-5" strokeWidth={1.5} />
        </button>
        <span className="text-sm">Background</span>
      </div>
      <div className="grid grid-cols-2 content-start gap-3 overflow-y-auto p-4">
        {backgrounds.map(({ color, id, label, src }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            /* Which one the desktop is on, said the way a control says it is pressed — and drawn
               with the border the chrome already uses, one shade stronger than the resting one. */
            aria-pressed={id === background}
            data-background={id}
            onClick={() => setBackground(id)}
            className="control overflow-hidden rounded-window border-2 border-window-border p-0.5 select-none [--control-scale:1.05] aria-pressed:border-window-foreground aria-pressed:bg-(--control-wash)"
          >
            {/* The wallpaper itself, at thumbnail size: the same image the engine covers the
                desktop with, or the same flat color it fills with. */}
            {src && (
              <img
                alt=""
                className="aspect-video w-full rounded-[calc(var(--window-radius)-0.25rem)] object-cover"
                draggable={false}
                src={src}
              />
            )}
            {color && (
              <span
                aria-hidden="true"
                className="block aspect-video w-full rounded-[calc(var(--window-radius)-0.25rem)]"
                style={{ background: color }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
