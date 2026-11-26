"""Creates notifications. The frontend only displays them; the server makes them.

Rule for all of them: nobody is notified about their own action.
"""
from .models import Follow, Notification


def notify_follow(actor, recipient):
    """`actor` followed `recipient`. Skipped if the same person already has an unread one."""
    if actor.pk == recipient.pk:
        return
    already_unread = Notification.objects.filter(
        recipient=recipient,
        actor=actor,
        type=Notification.Type.FOLLOW,
        is_read=False,
    ).exists()
    if not already_unread:
        Notification.objects.create(
            recipient=recipient, actor=actor, type=Notification.Type.FOLLOW
        )


def notify_comment(actor, blog):
    """`actor` commented on `blog`: tell the blog's author."""
    if actor.pk == blog.author_id:
        return
    Notification.objects.create(
        recipient_id=blog.author_id,
        actor=actor,
        type=Notification.Type.COMMENT,
        blog=blog,
    )


def notify_like(actor, blog):
    """`actor` liked `blog`. Once per person per blog, so toggling the like can't spam."""
    if actor.pk == blog.author_id:
        return
    already = Notification.objects.filter(
        recipient_id=blog.author_id,
        actor=actor,
        type=Notification.Type.LIKE,
        blog=blog,
    ).exists()
    if not already:
        Notification.objects.create(
            recipient_id=blog.author_id,
            actor=actor,
            type=Notification.Type.LIKE,
            blog=blog,
        )


def notify_new_post(blog):
    """A blog was published for the first time: tell the author's followers."""
    follower_ids = Follow.objects.filter(
        following_id=blog.author_id, follower__is_active=True
    ).values_list("follower_id", flat=True)
    Notification.objects.bulk_create(
        [
            Notification(
                recipient_id=follower_id,
                actor_id=blog.author_id,
                type=Notification.Type.NEW_POST,
                blog=blog,
            )
            for follower_id in follower_ids
        ],
        batch_size=500,
    )
