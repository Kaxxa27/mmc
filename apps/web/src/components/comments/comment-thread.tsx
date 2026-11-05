'use client';

import { MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { Avatar, Spinner } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import type { CommentView } from '@/lib/api/types';
import {
  type CommentTarget,
  useAddComment,
  useComments,
  useDeleteComment,
  useEditComment,
} from '@/lib/queries/groups';
import { formatRelative } from '@/lib/utils';

/** Renders `@username` mentions in bold. */
function withMentions(text: string): ReactNode[] {
  return text.split(/(@[a-z0-9_]{3,30})/g).map((part, index) =>
    /^@[a-z0-9_]{3,30}$/.test(part) ? (
      <span key={index} className="font-semibold text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function CommentItem({ comment, target }: { comment: CommentView; target: CommentTarget }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const edit = useEditComment(target);
  const remove = useDeleteComment(target);

  return (
    <li className="flex gap-3 py-3">
      <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{comment.author.displayName}</span>{' '}
          <span className="text-xs text-muted-foreground">
            {formatRelative(comment.createdAt)}
            {comment.edited ? ' · edited' : ''}
          </span>
        </p>
        {editing ? (
          <form
            className="mt-1 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              edit.mutate(
                { id: comment.id, body: body.trim() },
                { onSuccess: () => setEditing(false) },
              );
            }}
          >
            <Textarea
              value={body}
              maxLength={2000}
              rows={3}
              onChange={(event) => setBody(event.target.value)}
              aria-label="Edit comment"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={edit.isPending} disabled={!body.trim()}>
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setBody(comment.body);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed">
            {withMentions(comment.body)}
          </p>
        )}
      </div>
      {!editing && (comment.canEdit || comment.canDelete) ? (
        <div className="flex shrink-0 items-start gap-0.5">
          {comment.canEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit comment"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
            </Button>
          ) : null}
          {comment.canDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete comment"
              loading={remove.isPending}
              onClick={() => remove.mutate(comment.id)}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CommentThread({
  target,
  canComment,
}: {
  target: CommentTarget;
  canComment: boolean;
}) {
  const [page, setPage] = useState(1);
  const { data, isPending } = useComments(target, page);
  const add = useAddComment(target);
  const [body, setBody] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate(body.trim(), { onSuccess: () => setBody('') });
  }

  return (
    <div>
      {isPending ? (
        <Spinner className="py-6" />
      ) : !data || data.items.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" aria-hidden />
          No comments yet. Start the conversation.
        </p>
      ) : (
        <>
          <ul className="divide-y">
            {data.items.map((comment) => (
              <CommentItem
                key={`${comment.id}-${comment.updatedAt}`}
                comment={comment}
                target={target}
              />
            ))}
          </ul>
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
      {canComment ? (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
          <Textarea
            value={body}
            maxLength={2000}
            rows={3}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a comment… Mention someone with @username"
            aria-label="New comment"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && body.trim())
                submit(event);
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</p>
            <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()}>
              <Send aria-hidden />
              Comment
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
