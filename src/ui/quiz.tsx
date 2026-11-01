import { useState } from "react";
import { quizCopy, scoreQuiz } from "../lib/quiz";
import { useApp } from "./context";
import { go } from "./router";

export function QuizScreen() {
  const app = useApp();
  const quiz = app.library?.quiz;
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<number[]>([]);
  if (!quiz) return <p className="muted">Loading the quiz…</p>;

  if (step < 0) {
    return (
      <section>
        <p className="kicker">Placement</p>
        <h1>Let's see which plan fits.</h1>
        <p>{quiz.intro}</p>
        <button type="button" className="primary" onClick={() => setStep(0)}>Let's begin</button>
      </section>
    );
  }

  if (step >= quiz.questions.length) {
    const copy = quizCopy(quiz, answers);
    const fresh = app.state.logs.length === 0;
    return (
      <section>
        <p className="kicker">Result</p>
        <h1>We recommend {copy.levelName}</h1>
        {copy.lines.map((line) => <p key={line}>{line}</p>)}
        <p>{copy.summary}</p>
        <p className="muted">{fresh ? "Starting this plan sets the first progression for each track." : "You already have history, so logged steps stay where they are. Only the plan label and default warm-up change."}</p>
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (!app.library) return;
              app.dispatch({ type: "save-quiz", answers, level: copy.level });
              app.dispatch({ type: "start-plan", planId: copy.level, reseed: fresh, library: app.library });
              go({ name: "today" });
            }}
          >
            Start the {copy.levelName} plan
          </button>
          <button type="button" onClick={() => { setAnswers([]); setStep(-1); }}>Retake</button>
          <button type="button" className="text" onClick={() => go({ name: "today" })}>Close</button>
        </div>
      </section>
    );
  }

  const question = quiz.questions[step];
  return (
    <section>
      <div className="spread">
        <p className="kicker">{step + 1} of {quiz.questions.length}</p>
        <button type="button" className="text" onClick={() => go({ name: "today" })}>Close</button>
      </div>
      <h1>{question.title}</h1>
      <p>{question.prompt}</p>
      <div className="stack">
        {question.options.map((option, index) => (
          <button
            key={option.label}
            type="button"
            onClick={() => {
              const next = [...answers.slice(0, step), index];
              setAnswers(next);
              if (step + 1 === quiz.questions.length) scoreQuiz(next);
              setStep(step + 1);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
