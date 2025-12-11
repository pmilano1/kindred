'use client';

import { useMutation, useQuery } from '@apollo/client/react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Pencil, Reply, Send, Trash2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import {
  ADD_COMMENT,
  DELETE_COMMENT,
  GET_PERSON_COMMENTS,
  UPDATE_COMMENT,
} from '@/lib/graphql/queries';
import type { Comment } from '@/lib/types';

interface CommentsSectionProps {
  personId: string;
}

interface CommentItemProps {
  comment: Comment;
  personId: string;
  currentUserId?: string;
  isAdmin: boolean;
  onReply: (parentId: string) => void;
  replyingTo: string | null;
  onCancelReply: () => void;
}

function CommentItem({
  comment,
  personId,
  currentUserId,
  isAdmin,
  onReply,
  replyingTo,
  onCancelReply,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');

  const [updateComment, { loading: updating }] = useMutation(UPDATE_COMMENT, {
    refetchQueries: [{ query: GET_PERSON_COMMENTS, variables: { personId } }],
  });

  const [deleteComment, { loading: deleting }] = useMutation(DELETE_COMMENT, {
    refetchQueries: [{ query: GET_PERSON_COMMENTS, variables: { personId } }],
  });

  const [addReply, { loading: replying }] = useMutation(ADD_COMMENT, {
    refetchQueries: [{ query: GET_PERSON_COMMENTS, variables: { personId } }],
  });

  const canModify = currentUserId === comment.user_id || isAdmin;
  const isReplying = replyingTo === comment.id;

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    await updateComment({
      variables: { id: comment.id, content: editContent },
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Delete this comment?')) {
      await deleteComment({ variables: { id: comment.id } });
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    await addReply({
      variables: {
        personId,
        content: replyContent,
        parentCommentId: comment.id,
      },
    });
    setReplyContent('');
    onCancelReply();
  };

  const userName = comment.user?.name || comment.user?.email || 'Unknown';
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
  });

  return (
    <div className="border-l-2 border-gray-200 pl-4 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{userName}</span>
            <span>•</span>
            <span>{timeAgo}</span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-xs">(edited)</span>
            )}
          </div>
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdate} disabled={updating}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">
              {comment.content}
            </p>
          )}
        </div>
        {canModify && !isEditing && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {/* Reply button */}
      {!isEditing && !isReplying && (
        <button
          type="button"
          onClick={() => onReply(comment.id)}
          className="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
        >
          <Reply className="w-3 h-3" />
          Reply
        </button>
      )}
      {/* Reply form */}
      {isReplying && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            className="w-full"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleReply}
              disabled={replying || !replyContent.trim()}
            >
              <Send className="w-3 h-3 mr-1" />
              Reply
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancelReply}>
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}
      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              personId={personId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={onReply}
              replyingTo={replyingTo}
              onCancelReply={onCancelReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentsData {
  personComments: Comment[];
}

export default function CommentsSection({ personId }: CommentsSectionProps) {
  const { data: session } = useSession();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const { data, loading } = useQuery<CommentsData>(GET_PERSON_COMMENTS, {
    variables: { personId },
  });

  const [addComment, { loading: adding }] = useMutation(ADD_COMMENT, {
    refetchQueries: [{ query: GET_PERSON_COMMENTS, variables: { personId } }],
  });

  const currentUserId = session?.user?.id;
  const isAdmin = session?.user?.role === 'admin';
  const canComment = !!session?.user;

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment({ variables: { personId, content: newComment } });
    setNewComment('');
  };

  // Filter to only top-level comments (no parent)
  const topLevelComments = (data?.personComments || []).filter(
    (c: Comment) => !c.parent_comment_id,
  );

  return (
    <div className="card p-6">
      <h3 className="section-title flex items-center gap-2">
        <MessageCircle className="w-5 h-5" />
        Comments
        {topLevelComments.length > 0 && (
          <span className="text-sm font-normal text-gray-500">
            ({topLevelComments.length})
          </span>
        )}
      </h3>

      {/* Add comment form */}
      {canComment && (
        <div className="mb-4 space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full"
          />
          <Button
            onClick={handleAddComment}
            disabled={adding || !newComment.trim()}
            size="sm"
          >
            <Send className="w-4 h-4 mr-1" />
            Post Comment
          </Button>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading comments...</p>
      ) : topLevelComments.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No comments yet.{' '}
          {canComment ? 'Be the first to comment!' : 'Sign in to comment.'}
        </p>
      ) : (
        <div className="space-y-4">
          {topLevelComments.map((comment: Comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              personId={personId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={setReplyingTo}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
