"use client";

import { useRef } from "react";
import { useToast } from "./Shell";
import { Ic } from "./ui";
import { type ApiError, useAction } from "@/lib/api";

/** Upload or remove an avatar or banner; the API checks the bytes, this checks type and size first. */
export function ImagePick({ path, label, has }: { path: string; label: string; has: boolean }) {
  const act = useAction();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return toast("Bilder müssen PNG, JPG oder WebP sein.", "err");
    if (f.size > 5 * 1024 * 1024) return toast("Bilder dürfen bis 5 MB gross sein.", "err");
    const form = new FormData();
    form.set("file", f);
    try {
      await act(path, form);
      toast(`${label} gespeichert.`);
    } catch (e) {
      toast((e as ApiError).message, "err");
    }
  };
  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn btn-line btn-s" type="button" onClick={() => file.current?.click()}>
        <Ic name="upload" small />
        {label} hochladen
      </button>
      {has ? (
        <button
          className="btn btn-ghost btn-s"
          type="button"
          onClick={() =>
            act(path, {}, "DELETE").then(
              () => toast(`${label} entfernt.`),
              (e: ApiError) => toast(e.message, "err"),
            )
          }
        >
          Entfernen
        </button>
      ) : null}
      <input ref={file} className="sr" type="file" accept="image/png,image/jpeg,image/webp" tabIndex={-1} aria-hidden="true" onChange={(e) => void upload(e.target.files?.[0])} />
    </span>
  );
}
