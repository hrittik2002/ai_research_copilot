from typing import TypedDict

from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

from app.config import settings

llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.openai_api_key)


class ResearchState(TypedDict):
    topic: str
    objective: str
    result: str


def research_node(state: ResearchState) -> ResearchState:
    prompt = (
        f"Research topic: {state['topic']}\n"
        f"Objective: {state['objective']}\n"
        "Give a concise summary."
    )
    response = llm.invoke(prompt)
    return {**state, "result": response.content}


def build_research_graph():
    graph = StateGraph(ResearchState)
    graph.add_node("research", research_node)
    graph.add_edge(START, "research")
    graph.add_edge("research", END)
    return graph.compile()


research_graph = build_research_graph()