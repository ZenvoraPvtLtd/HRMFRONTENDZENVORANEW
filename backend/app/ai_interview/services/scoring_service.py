"""Deterministic, content-based scoring (no random fluctuation)."""
import re
from typing import List, Dict, Any

FILLERS = {"um","uh","like","you","know","basically","actually","literally","sort","kind","stuff","things"}
TECH_HINTS = {"algorithm","api","database","framework","function","class","async","query","cache","scale",
              "react","python","sql","docker","aws","redis","queue","schema","index","latency","throughput",
              "rest","graphql","jwt","oauth","kubernetes","microservice","testing","ci","cd","deployment"}
STRUCTURE = {"first","second","third","then","finally","because","therefore","however","example","specifically"}

def _metrics(text: str) -> Dict[str, float]:
    text = (text or "").strip()
    words = re.findall(r"[A-Za-z']+", text.lower())
    n = len(words)
    if n == 0:
        return {"technical":30,"communication":30,"confidence":30,"problem_solving":30}
    sentences = max(1, len(re.findall(r"[.!?]+", text)))
    avg_sent = n / sentences
    unique = len(set(words)) / n
    fillers = sum(1 for w in words if w in FILLERS) / n
    tech = sum(1 for w in words if w in TECH_HINTS)
    structure = sum(1 for w in words if w in STRUCTURE)

    # Communication: length + sentence flow + low fillers + vocabulary variety
    comm = 40 + min(25, n / 4) + min(15, (1 - fillers) * 15) + min(10, unique * 12) - max(0, avg_sent - 28)
    # Technical: density of tech keywords scaled by length
    technical = 45 + min(40, tech * 6) + min(10, n / 25)
    # Confidence: penalize heavy fillers; reward longer, structured answers
    confidence = 45 + min(25, (1 - fillers * 4) * 25) + min(15, n / 15) + min(10, structure * 2)
    # Problem solving: structural words + length
    problem = 42 + min(28, structure * 5) + min(20, n / 12) + min(10, tech * 2)

    clamp = lambda v: round(max(30, min(98, v)), 1)
    return {
        "technical": clamp(technical),
        "communication": clamp(comm),
        "confidence": clamp(confidence),
        "problem_solving": clamp(problem),
    }

def score_answer(answer_text: str) -> Dict[str, float]:
    return _metrics(answer_text)

def aggregate(answers: List[str]) -> Dict[str, Any]:
    answers = answers or [""]
    scores = [score_answer(a) for a in answers]
    avg = lambda k: round(sum(s[k] for s in scores) / len(scores), 1)
    tech = avg("technical"); comm = avg("communication")
    conf = avg("confidence"); ps = avg("problem_solving")
    final = round((tech * 0.35 + comm * 0.25 + conf * 0.15 + ps * 0.25), 1)
    rec = "Strong Hire" if final >= 85 else "Hire" if final >= 70 else "Maybe" if final >= 55 else "No Hire"
    strengths, weaknesses, suggestions = [], [], []
    for k, v in [("Technical depth", tech), ("Communication", comm),
                 ("Confidence", conf), ("Problem solving", ps)]:
        (strengths if v >= 75 else weaknesses).append(f"{k} ({v})")
    if comm < 75: suggestions.append("Structure answers using the STAR method (Situation, Task, Action, Result).")
    if tech < 75: suggestions.append("Deep-dive into core concepts and quantify project impact.")
    if conf < 75: suggestions.append("Reduce filler words ('um', 'like') and pause to think before answering.")
    if ps < 75: suggestions.append("Walk through your reasoning step-by-step before jumping to a solution.")
    if not suggestions: suggestions.append("Excellent overall — focus next on advanced system design scenarios.")
    return {
        "technical_score": tech, "communication_score": comm,
        "confidence_score": conf, "problem_solving_score": ps,
        "final_score": final, "recommendation": rec,
        "strengths": strengths, "weaknesses": weaknesses, "suggestions": suggestions,
    }
