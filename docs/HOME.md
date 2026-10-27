# Home — educational short videos

Home is Memskool’s **free** discovery feed for short educational clips. It is not a classroom, not Gold tutoring, and not a paid subscription.

## Who can do what

- Anyone (including signed-out visitors) can browse **published** videos on `/home`.
- Likes, saves, reports, interests and uploads require sign-in.
- Uploaders: approved teachers, school admins/institutions, superadmins, and **approved Gold tutors**.
- School-channel publishing: only the school’s admin/institution account, using the school id on their auth claims.
- Publication: `draft` → `pending_review` → `published`. Superadmin approves on `/home-admin`.

## Ranking

Rule-based: recency, like count, unique authenticated views, and optional subject interests. **Not an AI recommender.**

## Playback and storage

Files live at `home/{uid}/{videoId}/` in Firebase Storage. Firestore stores metadata only.

Public playback uses short-lived **Admin signed URLs**. Drafts are not listed in the catalog and are not given public URLs.

No Mux/Cloudinary/transcoding in this release.

## Views

A view is counted only for a signed-in user, at most once per video per 12 hours. Reloading the feed does not farm views.

## Safety

No public comments. Reports go to the superadmin queue. Creators must confirm rights and that the clip does not expose identifiable student footage. Student records and private school materials are never part of Home.
