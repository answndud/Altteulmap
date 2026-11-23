/**
 * 코멘트 삭제 권한 규칙(순수 함수). 운영자는 모두 삭제할 수 있고, 작성자는 자기 글만 지운다.
 * 작성자는 로그인 사용자 id 또는 익명 visitor id가 일치하면 본인으로 본다.
 */
type CommentActor = {
  userId: string | null;
  role: "user" | "admin" | null;
  visitorId: string | null;
};

type CommentOwner = {
  userId: string | null;
  visitorId: string | null;
};

export function canDeleteComment(actor: CommentActor, owner: CommentOwner) {
  if (actor.role === "admin") {
    return true;
  }

  const ownsAsUser = Boolean(owner.userId) && owner.userId === actor.userId;
  const ownsAsVisitor =
    Boolean(owner.visitorId) && owner.visitorId === actor.visitorId;

  return ownsAsUser || ownsAsVisitor;
}
