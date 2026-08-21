import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Eye, ImageIcon, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  EVENT_IMAGE_BUCKET,
  EVENT_IMAGE_LIMIT,
  eventImageStoragePath,
  validateEventImageFiles,
  type PendingEventImage,
} from "@/lib/attachment-files";
import { supabase } from "@/lib/supabase";
import {
  getListEventAttachmentsQueryKey,
  useCreateEventAttachment,
  useDeleteEventAttachment,
  useListEventAttachments,
} from "@workspace/api-client-react";
import type {
  EventAttachment,
  EventAttachmentEntityType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export type EventAttachmentsHandle = {
  savePending: (
    entityId: string,
  ) => Promise<{ uploaded: number; failed: number }>;
};

type ViewerImage = { src: string; alt: string } | null;

export const EventAttachmentsEditor = forwardRef<
  EventAttachmentsHandle,
  {
    entityType: EventAttachmentEntityType;
    entityId?: string;
  }
>(function EventAttachmentsEditor({ entityType, entityId }, ref) {
  const [pending, setPending] = useState<PendingEventImage[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<ViewerImage>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingEventImage[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = {
    entityType,
    entityId: entityId ?? "00000000-0000-0000-0000-000000000000",
  };
  const attachmentsQuery = useListEventAttachments(params, {
    query: {
      enabled: Boolean(entityId),
      queryKey: getListEventAttachmentsQueryKey(params),
    },
  });
  const createAttachment = useCreateEventAttachment();
  const deleteAttachment = useDeleteEventAttachment();
  const saved = useMemo(
    () => attachmentsQuery.data ?? [],
    [attachmentsQuery.data],
  );
  const count = saved.length + pending.length;

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(
    () => () => {
      pendingRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      saved.map(async (attachment) => {
        const { data } = await supabase.storage
          .from(EVENT_IMAGE_BUCKET)
          .createSignedUrl(attachment.storagePath, 60 * 60);
        return [attachment.id, data?.signedUrl] as const;
      }),
    ).then((entries) => {
      if (!cancelled)
        setSignedUrls(
          Object.fromEntries(
            entries.filter((entry): entry is readonly [string, string] =>
              Boolean(entry[1]),
            ),
          ),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const selectFiles = (files: File[]) => {
    const { accepted, rejected } = validateEventImageFiles(
      files,
      EVENT_IMAGE_LIMIT - count,
    );
    setPending((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    if (rejected.length > 0) {
      toast({
        title: `${rejected.length} imagem(ns) não adicionada(s)`,
        description: rejected[0]?.reason,
        variant: "destructive",
      });
    }
  };

  const removePending = (id: string) => {
    setPending((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  };

  const removeSaved = async (attachment: EventAttachment) => {
    try {
      const { error } = await supabase.storage
        .from(EVENT_IMAGE_BUCKET)
        .remove([attachment.storagePath]);
      if (error) throw error;
      await deleteAttachment.mutateAsync({ id: attachment.id });
      await queryClient.invalidateQueries({
        queryKey: getListEventAttachmentsQueryKey({
          entityType,
          entityId: attachment.entityId,
        }),
      });
    } catch (error) {
      toast({
        title: "Não foi possível apagar a imagem",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      savePending: async (savedEntityId) => {
        if (pending.length === 0) return { uploaded: 0, failed: 0 };
        setUploading(true);
        let uploaded = 0;
        let failed = 0;
        const completed = new Set<string>();

        for (const image of pending) {
          const storagePath = eventImageStoragePath(
            entityType,
            savedEntityId,
            image.file,
          );
          const { error: uploadError } = await supabase.storage
            .from(EVENT_IMAGE_BUCKET)
            .upload(storagePath, image.file, {
              contentType: image.file.type,
              upsert: false,
            });

          if (uploadError) {
            failed += 1;
            continue;
          }

          try {
            await createAttachment.mutateAsync({
              data: {
                entityType,
                entityId: savedEntityId,
                storagePath,
                originalFilename: image.file.name,
                mimeType: image.file.type,
                caption: null,
                sortOrder: saved.length + uploaded,
              },
            });
            completed.add(image.id);
            uploaded += 1;
          } catch {
            failed += 1;
            await supabase.storage
              .from(EVENT_IMAGE_BUCKET)
              .remove([storagePath]);
          }
        }

        setPending((current) =>
          current.filter((image) => {
            if (!completed.has(image.id)) return true;
            URL.revokeObjectURL(image.previewUrl);
            return false;
          }),
        );
        setUploading(false);
        await queryClient.invalidateQueries({
          queryKey: getListEventAttachmentsQueryKey({
            entityType,
            entityId: savedEntityId,
          }),
        });
        return { uploaded, failed };
      },
    }),
    [createAttachment, entityType, pending, queryClient, saved.length],
  );

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">
            Imagens / Referências
          </h3>
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? "imagem" : "imagens"} · máximo 10, 10 MB cada
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={count >= EVENT_IMAGE_LIMIT || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="h-4 w-4" />
          Adicionar imagens
        </Button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            selectFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      </div>

      {count > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {saved.map((attachment) => (
            <Thumbnail
              key={attachment.id}
              src={signedUrls[attachment.id]}
              alt={attachment.originalFilename}
              onOpen={() =>
                signedUrls[attachment.id] &&
                setViewer({
                  src: signedUrls[attachment.id],
                  alt: attachment.originalFilename,
                })
              }
              onRemove={() => void removeSaved(attachment)}
              disabled={deleteAttachment.isPending}
            />
          ))}
          {pending.map((image) => (
            <Thumbnail
              key={image.id}
              src={image.previewUrl}
              alt={image.file.name}
              pending
              onOpen={() =>
                setViewer({ src: image.previewUrl, alt: image.file.name })
              }
              onRemove={() => removePending(image.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Pode adicionar projetos, inspirações, materiais, plantas ou outras
          referências visuais.
        </div>
      )}
      {uploading ? (
        <p className="text-sm text-muted-foreground">A carregar imagens…</p>
      ) : null}
      <ImageViewer image={viewer} onClose={() => setViewer(null)} />
    </section>
  );
});

export function EventAttachmentsDetails({
  entityType,
  entityId,
}: {
  entityType: EventAttachmentEntityType;
  entityId: string;
}) {
  const { data: attachments } = useListEventAttachments({
    entityType,
    entityId,
  });
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<ViewerImage>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      (attachments ?? []).map(async (attachment) => {
        const { data } = await supabase.storage
          .from(EVENT_IMAGE_BUCKET)
          .createSignedUrl(attachment.storagePath, 60 * 60);
        return [attachment.id, data?.signedUrl] as const;
      }),
    ).then((entries) => {
      if (!cancelled)
        setSignedUrls(
          Object.fromEntries(
            entries.filter((entry): entry is readonly [string, string] =>
              Boolean(entry[1]),
            ),
          ),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  if (!attachments?.length) return null;

  return (
    <section className="mt-4 min-w-0 rounded-xl border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-semibold">Imagens / Referências</p>
        <span className="text-sm text-muted-foreground">
          {attachments.length} {attachments.length === 1 ? "imagem" : "imagens"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            className="group relative aspect-square min-w-0 overflow-hidden rounded-lg border border-border bg-muted"
            onClick={() =>
              signedUrls[attachment.id] &&
              setViewer({
                src: signedUrls[attachment.id],
                alt: attachment.originalFilename,
              })
            }
          >
            {signedUrls[attachment.id] ? (
              <img
                src={signedUrls[attachment.id]}
                alt={attachment.originalFilename}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="m-auto h-full w-8 text-muted-foreground" />
            )}
            <Eye className="absolute bottom-2 right-2 h-5 w-5 rounded bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
      <ImageViewer image={viewer} onClose={() => setViewer(null)} />
    </section>
  );
}

function Thumbnail({
  src,
  alt,
  pending,
  onOpen,
  onRemove,
  disabled,
}: {
  src?: string;
  alt: string;
  pending?: boolean;
  onOpen: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative aspect-square min-w-0 overflow-hidden rounded-lg border border-border bg-muted">
      <button
        type="button"
        className="h-full w-full"
        onClick={onOpen}
        aria-label={`Abrir ${alt}`}
      >
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="m-auto h-full w-8 text-muted-foreground" />
        )}
      </button>
      {pending ? (
        <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px]">
          Por guardar
        </span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-1 top-1 h-8 w-8 rounded-full"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remover ${alt}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ImageViewer({
  image,
  onClose,
}: {
  image: ViewerImage;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(image)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-5xl border-0 bg-black/95 p-2">
        <DialogHeader className="sr-only">
          <DialogTitle>{image?.alt ?? "Imagem"}</DialogTitle>
        </DialogHeader>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-3 top-3 z-10 rounded-full"
          onClick={onClose}
          aria-label="Fechar imagem"
        >
          <X className="h-4 w-4" />
        </Button>
        {image ? (
          <img
            src={image.src}
            alt={image.alt}
            className="max-h-[88vh] w-full object-contain"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
