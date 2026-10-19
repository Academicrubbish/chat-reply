export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        “
      </span>
      <span>
        <strong>言外</strong>
        <small>CHAT REPLY</small>
      </span>
    </div>
  );
}
export function ConversationArt() {
  return (
    <div className="conversation-art" aria-hidden="true">
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="art-note note-one">
        <span>THE SPACE BETWEEN WORDS</span>
        <i>
          每一句，
          <br />
          都可以更靠近。
        </i>
        <b>↗</b>
      </div>
      <div className="art-note note-two">
        <span>听见言外之意</span>
        <div className="art-lines">
          <i />
          <i />
          <i />
        </div>
        <b>“</b>
      </div>
      <span className="art-star">✳</span>
    </div>
  );
}
