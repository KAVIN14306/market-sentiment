"""
Fetches free, no-API-key RSS market headlines for India + World,
scores each with VADER sentiment, and writes docs/sentiment.json.

Run daily by the GitHub Actions workflow in .github/workflows/daily-sentiment.yml
"""

import json
import datetime
import feedparser
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

FEEDS = {
    "india": [
        "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "https://www.moneycontrol.com/rss/marketreports.xml",
        "https://www.business-standard.com/rss/markets-106.rss",
    ],
    "world": [
        "https://www.cnbc.com/id/10001147/device/rss/rss.html",  # CNBC Markets
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        "https://www.investing.com/rss/news_25.rss",  # World stock markets
    ],
}

MAX_HEADLINES_PER_REGION = 20
analyzer = SentimentIntensityAnalyzer()


def fetch_region(urls):
    items = []
    for url in urls:
        try:
            parsed = feedparser.parse(url)
            for entry in parsed.entries[:15]:
                title = entry.get("title", "").strip()
                link = entry.get("link", "")
                source = parsed.feed.get("title", url)
                if not title:
                    continue
                score = analyzer.polarity_scores(title)["compound"]
                items.append({
                    "title": title,
                    "link": link,
                    "source": source,
                    "score": round(score, 3),
                })
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")
    return items


def summarize(items):
    if not items:
        return {"headlines": [], "avg_score": 0, "mood": "No data", "positive": [], "negative": []}

    avg = sum(i["score"] for i in items) / len(items)
    positive = sorted([i for i in items if i["score"] > 0.15], key=lambda x: -x["score"])[:5]
    negative = sorted([i for i in items if i["score"] < -0.15], key=lambda x: x["score"])[:5]

    if avg > 0.15:
        mood = "Positive"
    elif avg < -0.15:
        mood = "Negative"
    else:
        mood = "Mixed / Neutral"

    return {
        "avg_score": round(avg, 3),
        "mood": mood,
        "positive": positive,
        "negative": negative,
        "sample_size": len(items),
    }


def main():
    output = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "regions": {},
    }
    for region, urls in FEEDS.items():
        items = fetch_region(urls)[:MAX_HEADLINES_PER_REGION]
        output["regions"][region] = summarize(items)

    with open("docs/sentiment.json", "w") as f:
        json.dump(output, f, indent=2)

    print("Wrote docs/sentiment.json")


if __name__ == "__main__":
    main()
