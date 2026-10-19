import { Button } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { ConversationArt } from "./Brand";
export default function OnboardingPage({
  onStart,
}: {
  onStart: () => void;
  isMobile?: boolean;
}) {
  return (
    <main className="onboarding">
      <div className="onboarding-copy">
        <span className="eyebrow">A LITTLE HELP, A BETTER CONVERSATION</span>
        <h1>
          下一句，
          <br />
          不必想那么久。
        </h1>
        <p>
          把聊天里的小纠结交给言外。
          <br />
          一起读懂对方，找到自然、真诚的回应。
        </p>
        <Button type="primary" size="large" onClick={onStart}>
          添加第一位聊天对象 <ArrowRightOutlined />
        </Button>
        <div className="onboarding-steps">
          <div>
            <b>01</b>
            <span>
              认识对方<small>添加资料与聊天背景</small>
            </span>
          </div>
          <div>
            <b>02</b>
            <span>
              读懂对话<small>输入或导入聊天记录</small>
            </span>
          </div>
          <div>
            <b>03</b>
            <span>
              找到表达<small>挑选建议，写出你的回应</small>
            </span>
          </div>
        </div>
      </div>
      <ConversationArt />
    </main>
  );
}
