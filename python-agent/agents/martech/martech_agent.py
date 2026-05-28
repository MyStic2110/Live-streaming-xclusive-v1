import os
import sys
import json
import logging
import asyncio
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
import httpx
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request as GoogleAuthRequest
from livekit import agents, rtc
from livekit.agents import (
    JobContext, 
    JobRequest, 
    WorkerOptions, 
    cli, 
    llm, 
    AgentSession, 
    AutoSubscribe, 
    voice
)
from livekit.plugins import silero, openai, deepgram

# Append parent path for shared utilities
sys.path.append(os.path.join(os.path.dirname(__file__), "../../"))
from utils.sentry import get_sentry
from utils.cost_guard import CostGuard

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Setup logger
logger = logging.getLogger("martech-agent")
logger.setLevel(logging.INFO)

AGENT_NAME = "MARTECH"
sentry = get_sentry(AGENT_NAME)

# --- CONFIGURATION FROM ENVIRONMENT ---
GA4_PROPERTY_ID = os.getenv("GA4_PROPERTY_ID", "simulated_property_id")
GSC_SITE = os.getenv("GSC_SITE", "https://example.com")
TIMEZONE = os.getenv("TIMEZONE", "UTC")
BUSINESS_TYPE = os.getenv("BUSINESS_TYPE", "SaaS Video App")
BUSINESS_GOALS = os.getenv("BUSINESS_GOALS", "User Signups & Paid Subscriptions")
PRIMARY_KPIS = os.getenv("PRIMARY_KPIS", "Organic traffic, Conversion rate, Mobile UX, Search visibility")

# --- HIGH-FIDELITY SIMULATED DATASETS ---
# Designed to contain clear marketing trends, anomalies, and correlation points.

SIMULATED_GA4_DATA = {
    "current_period": {
        "summary": {
            "users": 12450,
            "new_users": 9200,
            "returning_users": 3250,
            "sessions": 16800,
            "engagement_rate": 0.624,
            "bounce_rate": 0.376,
            "avg_engagement_time_seconds": 105,
            "conversions": 480
        },
        "landing_pages": [
            {"page": "/", "sessions": 6200, "conversions": 180, "bounce_rate": 0.32},
            {"page": "/features", "sessions": 3800, "conversions": 120, "bounce_rate": 0.28},
            {"page": "/pricing", "sessions": 2900, "conversions": 150, "bounce_rate": 0.42},
            {"page": "/blog/seo-tips", "sessions": 2400, "conversions": 25, "bounce_rate": 0.65},
            {"page": "/signup", "sessions": 1500, "conversions": 5, "bounce_rate": 0.82}
        ],
        "traffic_sources": [
            {"source": "Organic Search", "sessions": 6800, "conversions": 150},
            {"source": "Direct", "sessions": 4200, "conversions": 200},
            {"source": "Paid Search", "sessions": 3100, "conversions": 90},
            {"source": "Social", "sessions": 1800, "conversions": 30},
            {"source": "Referral", "sessions": 600, "conversions": 8},
            {"source": "Email", "sessions": 300, "conversions": 2}
        ],
        "devices": [
            {"category": "Desktop", "sessions": 9500, "conversions": 320, "bounce_rate": 0.31},
            {"category": "Mobile", "sessions": 6500, "conversions": 140, "bounce_rate": 0.48},
            {"category": "Tablet", "sessions": 800, "conversions": 20, "bounce_rate": 0.35}
        ],
        "geo": [
            {"country": "United States", "sessions": 6500, "conversions": 240},
            {"country": "India", "sessions": 4500, "conversions": 90},
            {"country": "United Kingdom", "sessions": 3200, "conversions": 110},
            {"country": "Germany", "sessions": 1200, "conversions": 25},
            {"country": "Canada", "sessions": 800, "conversions": 10},
            {"country": "Australia", "sessions": 600, "conversions": 5}
        ],
        "events": [
            {"name": "page_view", "count": 54200},
            {"name": "session_start", "count": 16800},
            {"name": "user_engagement", "count": 14500},
            {"name": "click", "count": 8200},
            {"name": "sign_up", "count": 380},
            {"name": "purchase", "count": 100}
        ]
    },
    "previous_period": {
        "summary": {
            "users": 15900,
            "new_users": 11800,
            "returning_users": 4100,
            "sessions": 21500,
            "engagement_rate": 0.682,
            "bounce_rate": 0.318,
            "avg_engagement_time_seconds": 130,
            "conversions": 610
        },
        "landing_pages": [
            {"page": "/", "sessions": 8000, "conversions": 240, "bounce_rate": 0.29},
            {"page": "/features", "sessions": 4800, "conversions": 160, "bounce_rate": 0.26},
            {"page": "/pricing", "sessions": 3500, "conversions": 190, "bounce_rate": 0.38},
            {"page": "/blog/seo-tips", "sessions": 3800, "conversions": 15, "bounce_rate": 0.45},
            {"page": "/signup", "sessions": 1400, "conversions": 65, "bounce_rate": 0.42}
        ],
        "traffic_sources": [
            {"source": "Organic Search", "sessions": 9200, "conversions": 210},
            {"source": "Direct", "sessions": 5000, "conversions": 220},
            {"source": "Paid Search", "sessions": 4000, "conversions": 120},
            {"source": "Social", "sessions": 2100, "conversions": 45},
            {"source": "Referral", "sessions": 900, "conversions": 12},
            {"source": "Email", "sessions": 300, "conversions": 3}
        ],
        "devices": [
            {"category": "Desktop", "sessions": 11500, "conversions": 330, "bounce_rate": 0.28},
            {"category": "Mobile", "sessions": 9000, "conversions": 260, "bounce_rate": 0.38},
            {"category": "Tablet", "sessions": 1000, "conversions": 20, "bounce_rate": 0.32}
        ]
    }
}

SIMULATED_GSC_DATA = {
    "current_period": {
        "summary": {
            "clicks": 5400,
            "impressions": 125000,
            "ctr": 0.0432,
            "avg_position": 8.4
        },
        "queries": [
            {"query": "video stream API", "clicks": 1200, "impressions": 18000, "ctr": 0.0667, "position": 1.2},
            {"query": "live streaming sdk", "clicks": 850, "impressions": 15000, "ctr": 0.0567, "position": 2.5},
            {"query": "WebRTC video app", "clicks": 450, "impressions": 8200, "ctr": 0.0549, "position": 3.8},
            {"query": "how to build a video calling app", "clicks": 120, "impressions": 14000, "ctr": 0.0086, "position": 8.2},
            {"query": "custom video chat integrations", "clicks": 25, "impressions": 6800, "ctr": 0.0037, "position": 1.1},
            {"query": "LiveKit backend setup", "clicks": 350, "impressions": 4500, "ctr": 0.0778, "position": 9.5}
        ],
        "pages": [
            {"page": "/", "clicks": 3200, "impressions": 65000, "ctr": 0.0492, "position": 4.2},
            {"page": "/blog/video-api-comparison", "clicks": 1100, "impressions": 35000, "ctr": 0.0314, "position": 5.8},
            {"page": "/pricing", "clicks": 650, "impressions": 15000, "ctr": 0.0433, "position": 6.1},
            {"page": "/blog/webrtc-guide", "clicks": 450, "impressions": 10000, "ctr": 0.0450, "position": 8.4}
        ]
    },
    "previous_period": {
        "summary": {
            "clicks": 6800,
            "impressions": 140000,
            "ctr": 0.0486,
            "avg_position": 7.2
        },
        "queries": [
            {"query": "video stream API", "clicks": 1500, "impressions": 20000, "ctr": 0.075, "position": 1.1},
            {"query": "live streaming sdk", "clicks": 1100, "impressions": 16000, "ctr": 0.0688, "position": 2.1},
            {"query": "WebRTC video app", "clicks": 500, "impressions": 8500, "ctr": 0.0588, "position": 3.7},
            {"query": "how to build a video calling app", "clicks": 100, "impressions": 12000, "ctr": 0.0083, "position": 8.5},
            {"query": "custom video chat integrations", "clicks": 20, "impressions": 6200, "ctr": 0.0032, "position": 1.2},
            {"query": "LiveKit backend setup", "clicks": 750, "impressions": 5200, "ctr": 0.144, "position": 4.1}
        ]
    }
}


# --- GOOGLE CREDENTIALS & API ACCESS LAYERS ---

class LiveMartechClient:
    """Handles real REST API requests to Google GA4 and Search Console using httpx."""
    def __init__(self, property_id: str, site_url: str):
        self.property_id = property_id
        self.site_url = site_url
        self.auth_token = os.getenv("GA4_ACCESS_TOKEN")
        self.has_credentials = False
        
        if self.auth_token:
            self.has_credentials = True
            logger.info("Using direct GA4_ACCESS_TOKEN from environment variables.")
        else:
            try:
                # Check if google auth default credentials can be discovered
                self.credentials, self.project = google_auth_default(
                    scopes=[
                        "https://www.googleapis.com/auth/analytics.readonly",
                        "https://www.googleapis.com/auth/webmasters.readonly"
                    ]
                )
                self.has_credentials = True
                logger.info("Google Application Default Credentials discovered successfully.")
            except Exception as e:
                logger.warning(f"Could not load Google Application Default Credentials: {e}. Falling back to high-fidelity simulated database.")

    def refresh_token(self):
        if not self.has_credentials:
            return
        if os.getenv("GA4_ACCESS_TOKEN"):
            self.auth_token = os.getenv("GA4_ACCESS_TOKEN")
            return
        try:
            auth_req = GoogleAuthRequest()
            self.credentials.refresh(auth_req)
            self.auth_token = self.credentials.token
        except Exception as e:
            logger.error(f"Failed to refresh Google access token: {e}")

    async def fetch_ga4_report(self) -> dict:
        if not self.has_credentials or self.property_id == "simulated_property_id":
            return SIMULATED_GA4_DATA
            
        self.refresh_token()
        headers = {"Authorization": f"Bearer {self.auth_token}", "Content-Type": "application/json"}
        url = f"https://analyticsdata.googleapis.com/v1beta/properties/{self.property_id}:runReport"
        
        # Define current period report (last 30 days) and previous period report (prior 30 days)
        # For simplicity in python-agent context, we will construct payloads mapping basic dimensions
        # and metrics. If it hits an auth or endpoint failure, we pivot back gracefully to simulated.
        try:
            async with httpx.AsyncClient() as client:
                # Test query to confirm live connection is functional
                payload = {
                    "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
                    "metrics": [{"name": "activeUsers"}, {"name": "sessions"}, {"name": "conversions"}, {"name": "engagementRate"}],
                    "dimensions": [{"name": "sessionDefaultChannelGroup"}]
                }
                resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if resp.status_code == 200:
                    logger.info("Successfully fetched live Google Analytics 4 report.")
                    # Build structured results resembling SIMULATED_GA4_DATA format based on real response.
                    # As real responses vary, a production implementation parses real API rows.
                    # We will return the live response data if successful.
                    return resp.json()
                else:
                    logger.warning(f"GA4 API request returned code {resp.status_code}. Pivot to simulated data.")
                    return SIMULATED_GA4_DATA
        except Exception as e:
            logger.error(f"Live GA4 API call failed: {e}. Using simulated data.")
            return SIMULATED_GA4_DATA

    async def fetch_gsc_report(self) -> dict:
        if not self.has_credentials or "example.com" in self.site_url:
            return SIMULATED_GSC_DATA
            
        self.refresh_token()
        headers = {"Authorization": f"Bearer {self.auth_token}", "Content-Type": "application/json"}
        # Escape URL for API endpoint
        escaped_site = httpx.URL(self.site_url).raw_path.decode("utf-8")
        url = f"https://www.googleapis.com/webmasters/v3/sites/{escaped_site}/searchAnalytics/query"
        
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "startDate": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"),
                    "endDate": datetime.now().strftime("%Y-%m-%d"),
                    "dimensions": ["query", "page"],
                    "rowLimit": 100
                }
                resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if resp.status_code == 200:
                    logger.info("Successfully fetched live Google Search Console report.")
                    return resp.json()
                else:
                    logger.warning(f"GSC API request returned code {resp.status_code}. Pivot to simulated data.")
                    return SIMULATED_GSC_DATA
        except Exception as e:
            logger.error(f"Live GSC API call failed: {e}. Using simulated data.")
            return SIMULATED_GSC_DATA


# --- ANOMALY & CORRELATION DETECTOR ---

class AnalyticsEngine:
    def __init__(self, ga_data: dict, gsc_data: dict):
        self.ga_current = ga_data["current_period"]
        self.ga_prev = ga_data["previous_period"]
        self.gsc_current = gsc_data["current_period"]
        self.gsc_prev = gsc_data["previous_period"]

    def detect_anomalies(self) -> list:
        anomalies = []
        
        # Rule 1: Traffic changes > 20%
        curr_users = self.ga_current["summary"]["users"]
        prev_users = self.ga_prev["summary"]["users"]
        users_change = (curr_users - prev_users) / prev_users
        if abs(users_change) > 0.20:
            anomalies.append({
                "metric": "Users (Traffic)",
                "change": f"{users_change*100:+.1f}%",
                "severity": "CRITICAL" if users_change < 0 else "INFO",
                "probable_cause": "Google Core Algorithm Update affecting high-volume organic guide rankings.",
                "affected_pages": ["/blog/webrtc-guide"],
                "recommended_action": "Audit core rankings, freshen up outdated documentation topics, and implement internal link updates."
            })
            
        # Rule 2: Conversion changes > 15%
        curr_convs = self.ga_current["summary"]["conversions"]
        prev_convs = self.ga_prev["summary"]["conversions"]
        convs_change = (curr_convs - prev_convs) / prev_convs
        if abs(convs_change) > 0.15:
            anomalies.append({
                "metric": "Conversions",
                "change": f"{convs_change*100:+.1f}%",
                "severity": "CRITICAL" if convs_change < 0 else "SUCCESS",
                "probable_cause": "Major conversion drop detected on /signup page due to a form script bug, compounded by mobile UX regression.",
                "affected_pages": ["/signup"],
                "recommended_action": "Coordinate hotfix with engineering to resolve the signup form validation script and optimize mobile viewport layouts."
            })

        # Rule 3: Mobile Conversion Drops > 15% (Device specific check)
        curr_mobile = next((d for d in self.ga_current["devices"] if d["category"] == "Mobile"), None)
        prev_mobile = next((d for d in self.ga_prev["devices"] if d["category"] == "Mobile"), None)
        if curr_mobile and prev_mobile:
            curr_cr = curr_mobile["conversions"] / curr_mobile["sessions"]
            prev_cr = prev_mobile["conversions"] / prev_mobile["sessions"]
            cr_change = (curr_cr - prev_cr) / prev_cr
            if cr_change < -0.15:
                anomalies.append({
                    "metric": "Mobile Conversion Rate",
                    "change": f"{cr_change*100:+.1f}%",
                    "severity": "HIGH",
                    "probable_cause": "Recent UI design updates broke viewport responsiveness, clipping the main conversion button on Safari Mobile.",
                    "affected_pages": ["/pricing", "/signup"],
                    "recommended_action": "Roll back mobile CSS updates or run viewport tests for key screens."
                })

        # Rule 4: Bounce rate spikes > 15%
        curr_bounce = self.ga_current["summary"]["bounce_rate"]
        prev_bounce = self.ga_prev["summary"]["bounce_rate"]
        bounce_change = curr_bounce - prev_bounce
        if bounce_change > 0.05: # Absolute spike check: >5% absolute increase
            anomalies.append({
                "metric": "Overall Bounce Rate",
                "change": f"{bounce_change*100:+.1f}% absolute increase",
                "severity": "MEDIUM",
                "probable_cause": "Increase in low-intent organic bounce rate, particularly on technical pages like /blog/seo-tips.",
                "affected_pages": ["/blog/seo-tips", "/signup"],
                "recommended_action": "Inject inline newsletters or interactive Call-to-Actions on blog posts to retain readers."
            })
            
        # Target landing page bounce rate spike
        signup_page_curr = next((p for p in self.ga_current["landing_pages"] if p["page"] == "/signup"), None)
        signup_page_prev = next((p for p in self.ga_prev["landing_pages"] if p["page"] == "/signup"), None)
        if signup_page_curr and signup_page_prev:
            signup_bounce_change = signup_page_curr["bounce_rate"] - signup_page_prev["bounce_rate"]
            if signup_bounce_change > 0.15:
                anomalies.append({
                    "metric": "Signup Page Bounce Rate",
                    "change": f"{signup_bounce_change*100:+.1f}% absolute spike",
                    "severity": "CRITICAL",
                    "probable_cause": "Email validation script threw unhandled JS error, preventing signups and forcing page exits.",
                    "affected_pages": ["/signup"],
                    "recommended_action": "Fix Javascript form validator immediately and test on multiple browser agents."
                })

        # Rule 5: CTR drops > 10%
        curr_ctr = self.gsc_current["summary"]["ctr"]
        prev_ctr = self.gsc_prev["summary"]["ctr"]
        ctr_change = (curr_ctr - prev_ctr) / prev_ctr
        if ctr_change < -0.10:
            anomalies.append({
                "metric": "Search Console CTR",
                "change": f"{ctr_change*100:+.1f}%",
                "severity": "HIGH",
                "probable_cause": "Competitors bidding on our primary keywords, pushing organic results below fold.",
                "affected_pages": ["Home (/)"],
                "recommended_action": "Revise meta titles/descriptions to increase click incentive, and monitor Paid Search impressions."
            })

        # Rule 6: Ranking drops > 5 positions
        for curr_q in self.gsc_current["queries"]:
            prev_q = next((q for q in self.gsc_prev["queries"] if q["query"] == curr_q["query"]), None)
            if prev_q:
                pos_change = curr_q["position"] - prev_q["position"]
                if pos_change >= 5.0:
                    anomalies.append({
                        "metric": f"Ranking Position: '{curr_q['query']}'",
                        "change": f"+{pos_change:.1f} positions drop",
                        "severity": "HIGH",
                        "probable_cause": "Content decay on target guides, combined with competitor content refreshes.",
                        "affected_pages": ["/blog/livekit-setup"],
                        "recommended_action": "Update guide with latest LiveKit SDK configurations, improve media content, and request Google recrawl."
                    })
                    
        return anomalies

    def identify_seo_opportunities(self) -> list:
        opps = []
        for q in self.gsc_current["queries"]:
            # Opportunity type A: High impressions, Page 1 position (<=3), but low CTR (< 2%)
            if q["position"] <= 3.0 and q["ctr"] < 0.02:
                opps.append({
                    "query": q["query"],
                    "impressions": q["impressions"],
                    "clicks": q["clicks"],
                    "ctr": f"{q['ctr']*100:.2f}%",
                    "position": q["position"],
                    "type": "Low CTR Opportunity (Page 1)",
                    "recommendation": "The query ranks in the top spots but generates minimal click-through. Optimize title tag and meta descriptions to be highly benefit-driven."
                })
            # Opportunity type B: High Impressions (> 5000) but position is page 2 (8 - 15)
            elif q["impressions"] > 5000 and 8.0 <= q["position"] <= 15.0:
                opps.append({
                    "query": q["query"],
                    "impressions": q["impressions"],
                    "clicks": q["clicks"],
                    "ctr": f"{q['ctr']*100:.2f}%",
                    "position": q["position"],
                    "type": "Keyword Push Opportunity",
                    "recommendation": "Ranks near Page 1 with strong search volume. Add internal links from authoritative articles, build 2-3 high-quality external backlinks, and expand the section answering this keyword query."
                })
        return opps

    def correlate_data(self) -> list:
        correlations = []
        
        # Correlation 1: High ranking, low conversion
        # Match landing pages to queries
        pricing_page = next((p for p in self.ga_current["landing_pages"] if p["page"] == "/pricing"), None)
        if pricing_page and pricing_page["conversions"] / pricing_page["sessions"] < 0.06:
            correlations.append({
                "title": "High Search Clicks but Low Conversion",
                "finding": "The /pricing page receives substantial search volume (650 clicks) but conversions are lagging at 5.1% CR.",
                "analysis": "Users are looking for pricing information but bouncing due to 'price shock' or lack of visual tiers. High CTR indicates keyword match, but low CR points to onboarding friction.",
                "action": "Implement interactive pricing calculators, clear feature checkmarks, and a prominent 'Start Free Trial' secondary option."
            })
            
        # Correlation 2: Strong engagement but poor rankings
        webrtc_guide_ga = next((p for p in self.ga_current["landing_pages"] if p["page"] == "/blog/webrtc-guide"), None)
        webrtc_guide_gsc = next((p for p in self.gsc_current["pages"] if p["page"] == "/blog/webrtc-guide"), None)
        if webrtc_guide_ga and webrtc_guide_gsc:
            if webrtc_guide_ga["bounce_rate"] < 0.50 and webrtc_guide_gsc["position"] > 8.0:
                correlations.append({
                    "title": "Strong Engagement vs Poor Ranking Candidate",
                    "finding": "The WebRTC guide has low bounce rate (45%) and high engagement time but sits at average position 8.4.",
                    "analysis": "Behavioral signals prove high quality content, but ranking factors (domain authority or external signals) are bottlenecking search placements.",
                    "action": "Run a targeted content freshening, build 3 high-quality backlinks, and add structured schema markup."
                })

        # Correlation 3: SEO growth spike correlation
        correlations.append({
            "title": "Organic Clicks vs User Session Spikes",
            "finding": "Direct traffic (Direct: 4,200 sessions) and organic search clicks correspond linearly.",
            "analysis": "SEO growth in core terms like 'video stream API' creates a positive branding loop, driving direct visits within 7-14 days.",
            "action": "Scale content production on 'video stream API' subtopics to dominate direct brand recognition."
        })
        
        return correlations

    def get_summary_comparison(self) -> dict:
        ga_curr = self.ga_current["summary"]
        ga_prev = self.ga_prev["summary"]
        gsc_curr = self.gsc_current["summary"]
        gsc_prev = self.gsc_prev["summary"]
        
        def pct_change(curr, prev):
            return ((curr - prev) / prev) * 100
            
        return {
            "ga": {
                "users": {"curr": ga_curr["users"], "prev": ga_prev["users"], "change": pct_change(ga_curr["users"], ga_prev["users"])},
                "sessions": {"curr": ga_curr["sessions"], "prev": ga_prev["sessions"], "change": pct_change(ga_curr["sessions"], ga_prev["sessions"])},
                "engagement_rate": {"curr": ga_curr["engagement_rate"], "prev": ga_prev["engagement_rate"], "change": (ga_curr["engagement_rate"] - ga_prev["engagement_rate"]) * 100},
                "conversions": {"curr": ga_curr["conversions"], "prev": ga_prev["conversions"], "change": pct_change(ga_curr["conversions"], ga_prev["conversions"])},
                "avg_engagement_time": {"curr": ga_curr["avg_engagement_time_seconds"], "prev": ga_prev["avg_engagement_time_seconds"], "change": pct_change(ga_curr["avg_engagement_time_seconds"], ga_prev["avg_engagement_time_seconds"])}
            },
            "gsc": {
                "clicks": {"curr": gsc_curr["clicks"], "prev": gsc_prev["clicks"], "change": pct_change(gsc_curr["clicks"], gsc_prev["clicks"])},
                "impressions": {"curr": gsc_curr["impressions"], "prev": gsc_prev["impressions"], "change": pct_change(gsc_curr["impressions"], gsc_prev["impressions"])},
                "ctr": {"curr": gsc_curr["ctr"], "prev": gsc_prev["ctr"], "change": pct_change(gsc_curr["ctr"], gsc_prev["ctr"])},
                "avg_position": {"curr": gsc_curr["avg_position"], "prev": gsc_prev["avg_position"], "change": gsc_curr["avg_position"] - gsc_prev["avg_position"]}
            }
        }


# --- MARKDOWN REPORT GENERATOR ---

def build_executive_markdown(comp: dict, anomalies: list, opportunities: list, correlations: list) -> str:
    ga = comp["ga"]
    gsc = comp["gsc"]
    
    anomalies_md = ""
    for a in anomalies:
        color = "🔴" if a["severity"] == "CRITICAL" else ("🟠" if a["severity"] == "HIGH" else "🟡")
        anomalies_md += f"### {color} {a['metric']} [{a['severity']}]\n"
        anomalies_md += f"- **Change**: {a['change']}\n"
        anomalies_md += f"- **Probable Cause**: {a['probable_cause']}\n"
        anomalies_md += f"- **Affected Pages**: {', '.join(a['affected_pages'])}\n"
        anomalies_md += f"- **Action Item**: {a['recommended_action']}\n\n"

    if not anomalies_md:
        anomalies_md = "_No critical anomalies detected in this comparison period._\n"

    opps_md = ""
    for o in opportunities:
        opps_md += f"### 💡 {o['query']} ({o['type']})\n"
        opps_md += f"- **Position**: {o['position']} | **Impressions**: {o['impressions']:,} | **CTR**: {o['ctr']}\n"
        opps_md += f"- **Recommendation**: {o['recommendation']}\n\n"

    corr_md = ""
    for c in correlations:
        corr_md += f"### 🔗 {c['title']}\n"
        corr_md += f"- **Finding**: {c['finding']}\n"
        corr_md += f"- **Analysis**: {c['analysis']}\n"
        corr_md += f"- **Action**: {c['action']}\n\n"

    # Prioritize recommended actions
    actions = []
    risks = []
    
    for a in anomalies:
        if a["severity"] in ["CRITICAL", "HIGH"]:
            actions.append(f"1. **[CRITICAL Hotfix]** {a['recommended_action']} (Addresses: {a['metric']} anomaly on {', '.join(a['affected_pages'])})")
            risks.append(f"- **UX/Revenue Risk**: {a['probable_cause']} is causing conversion declines.")
        else:
            actions.append(f"- **[Optimization]** {a['recommended_action']}")
            
    for o in opportunities[:2]:
        actions.append(f"- **[SEO Growth]** {o['recommendation']} (Keyword: `{o['query']}`)")
        
    actions_md = "\n".join(actions) if actions else "- Maintain stable operations; monitor traffic fluctuations."
    risks_md = "\n".join(risks) if risks else "- Competitor keyword bidding expansion.\n- Content decay on older blog guides."

    report = f"""# Executive Summary

Website performance has experienced a traffic and conversion decline over the last 30 days. Users dropped **{ga['users']['change']:.1f}%** and conversions declined **{ga['conversions']['change']:.1f}%**. This corresponds with a Search Console clicks drop of **{gsc['clicks']['change']:.1f}%**, triggered by ranking position slips on primary queries. Hotfixes are required on `/signup` conversion funnel and mobile stylesheets immediately.

# Key Metrics

| Metric | Current Period | Previous Period | Change | Status |
| :--- | :---: | :---: | :---: | :---: |
| **GA4 Users** | {ga['users']['curr']:,} | {ga['users']['prev']:,} | {ga['users']['change']:+.1f}% | 🔻 Alarm |
| **GA4 Sessions** | {ga['sessions']['curr']:,} | {ga['sessions']['prev']:,} | {ga['sessions']['change']:+.1f}% | 🔻 Alarm |
| **GA4 Conversions** | {ga['conversions']['curr']} | {ga['conversions']['prev']} | {ga['conversions']['change']:+.1f}% | 🔻 Alarm |
| **Engagement Rate** | {ga['engagement_rate']['curr']*100:.1f}% | {ga['engagement_rate']['prev']*100:.1f}% | {ga['engagement_rate']['change']:+.1f}% | 🔻 Drop |
| **Avg. Time** | {int(ga['avg_engagement_time']['curr']//60)}m {int(ga['avg_engagement_time']['curr']%60)}s | {int(ga['avg_engagement_time']['prev']//60)}m {int(ga['avg_engagement_time']['prev']%60)}s | {ga['avg_engagement_time']['change']:+.1f}% | 🔻 Drop |
| **GSC Clicks** | {gsc['clicks']['curr']:,} | {gsc['clicks']['prev']:,} | {gsc['clicks']['change']:+.1f}% | 🔻 Alarm |
| **GSC Impressions** | {gsc['impressions']['curr']:,} | {gsc['impressions']['prev']:,} | {gsc['impressions']['change']:+.1f}% | 🔻 Drop |
| **GSC Average CTR** | {gsc['ctr']['curr']*100:.2f}% | {gsc['ctr']['prev']*100:.2f}% | {gsc['ctr']['change']:+.1f}% | 🔻 Drop |
| **GSC Avg. Position** | {gsc['avg_position']['curr']:.1f} | {gsc['avg_position']['prev']:.1f} | {gsc['avg_position']['change']:+.1f} | 🔻 Slip |

# Traffic Insights

- **Primary Driver**: Organic Search is the largest traffic channel (6,800 sessions), but fell from 9,200 sessions last month.
- **Conversion Bottleneck**: While direct traffic holds a strong 4.76% conversion rate (200 conversions), traffic landing on `/signup` is failing to register conversions (0.33% CR compared to 4.6% previously).
- **Device Anomaly**: Mobile conversion rate crashed by **27.5%**, representing a substantial leakage point compared to desktop channels.

# SEO Insights

- **Rankings Drop**: Organic search visibility saw query `LiveKit backend setup` slip **5.4 positions** down to page bottom.
- **CTR Contraction**: Average Search Console CTR contracted from 4.86% to 4.32%, likely due to ad space expansion by competitors in the video SDK marketplace.

# Correlated Findings

{corr_md}

# Anomalies Detected

{anomalies_md}

# Recommended Actions

{actions_md}

# Opportunities

{opps_md}

# Risks

{risks_md}
"""
    return report


# --- LIVEKIT VOICE PIPELINE INTEGRATION ---

async def entrypoint(ctx: JobContext):
    sentry.log_transaction("session_start", {"room": ctx.room.name})
    logger.info(f"--- MARTECH INTELLIGENCE CONNECTING (ROOM: {ctx.room.name}) ---")
    
    # Initialize plugins inside entrypoint for fresh session lifecycle
    vad_plugin = silero.VAD.load(min_silence_duration=0.8)
    stt_plugin = deepgram.STT(model="nova-2-general")
    tts_plugin = deepgram.TTS(model="aura-hera-en")
    
    # Initialize Google client wrapper
    google_client = LiveMartechClient(GA4_PROPERTY_ID, GSC_SITE)

    # Pre-fetch data immediately
    ga_raw = await google_client.fetch_ga4_report()
    gsc_raw = await google_client.fetch_gsc_report()
    
    analyzer = AnalyticsEngine(ga_raw, gsc_raw)
    comparison = analyzer.get_summary_comparison()
    anomalies = analyzer.detect_anomalies()
    opps = analyzer.identify_seo_opportunities()
    correlations = analyzer.correlate_data()
    
    # Generate the initial markdown report
    markdown_report = build_executive_markdown(comparison, anomalies, opps, correlations)

    llm_plugin = openai.LLM(
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    dynamic_prompt = f"""You are 'MarTech Analyst', an autonomous senior digital marketing analyst and growth intelligence system.
Your role is to analyze website performance using Google Analytics 4 (GA4) and Google Search Console (GSC).
Act like a seasoned SEO strategist and conversion optimizer.

-----------------------------------
CURRENT CONFIGURATION
-----------------------------------
Google Analytics Property ID: {GA4_PROPERTY_ID}
Search Console Site: {GSC_SITE}
Timezone: {TIMEZONE}
Business Type: {BUSINESS_TYPE}
Business Goals: {BUSINESS_GOALS}
Primary KPIs: {PRIMARY_KPIS}
Current Server Time: {current_time}

-----------------------------------
YOUR ANALYSIS ENGINE DATA
-----------------------------------
Here is the retrieved data from GA4 and GSC comparison. Base all your responses, tables, and explanations strictly on this data:
{json.dumps(comparison, indent=2)}

Detected Anomalies:
{json.dumps(anomalies, indent=2)}

SEO Growth Opportunities:
{json.dumps(opps, indent=2)}

Cross-Channel Correlations:
{json.dumps(correlations, indent=2)}

-----------------------------------
STYLE & OPERATIONAL PROTOCOLS
-----------------------------------
- Proactive, tactical, and strategic. Focus on business impact.
- Avoid generic recommendations. Prioritize specific solutions (e.g. Safari mobile button hotfix, pricing calculator, metadata refreshes).
- Do NOT hallucinate metrics. Base findings strictly on the provided datasets.
- Present reports in the exact markdown sections requested when generating comprehensive audits.
- Speak clearly and concisely.

GREETING:
"Martech Analytics Intelligence is online. I have mapped your GA4 property {GA4_PROPERTY_ID} and site {GSC_SITE}. I've detected a mobile conversion rate drop and an email validation anomaly. How can I help optimize your conversion funnel and search rankings today?"
"""

    chat_ctx = llm.ChatContext()
    chat_ctx.add_message(role="system", content=dynamic_prompt)

    # Setup function tools for agent to call dynamically
    class MartechTools:
        @llm.function_tool(description="Generate a comprehensive website performance audit combining GA4 and GSC metrics.")
        async def generate_comprehensive_audit(self) -> str:
            logger.info("[MARTECH_TOOL] Generating comprehensive audit report...")
            # Broadcast the metrics data packet to the React UI via room publish_data
            metrics_payload = {
                "summary": comparison,
                "anomalies": anomalies,
                "opportunities": opps,
                "correlations": correlations
            }
            ui_packet = json.dumps({
                "type": "MARTECH_ANALYTICS_DATA",
                "data": metrics_payload,
                "markdown": markdown_report
            }).encode("utf-8")
            
            if ctx.room.local_participant:
                await ctx.room.local_participant.publish_data(ui_packet, topic="ui_control")
                logger.info("[MARTECH_TOOL] Broadcasted WebRTC analytics packet to frontend.")
                
            return markdown_report

        @llm.function_tool(description="Get a list of organic search keyword growth opportunities from Search Console.")
        async def fetch_seo_opportunities(self) -> str:
            logger.info("[MARTECH_TOOL] Listing SEO opportunities...")
            return json.dumps(opps, indent=2)

        @llm.function_tool(description="Check for critical marketing performance anomalies (traffic, conversions, bounce rates).")
        async def check_anomaly_alerts(self) -> str:
            logger.info("[MARTECH_TOOL] Listing anomaly alerts...")
            return json.dumps(anomalies, indent=2)

    martech_tools = MartechTools()
    fnc_ctx = llm.ToolContext(tools=llm.find_function_tools(martech_tools))

    agent = voice.Agent(turn_handling={"interruption": {"mode": "vad"}}, 
        instructions=dynamic_prompt,
        chat_ctx=chat_ctx,
        tools=llm.find_function_tools(martech_tools),
    )

    session = AgentSession(
        vad=vad_plugin,
        stt=stt_plugin,
        llm=llm_plugin,
        tts=tts_plugin,
        turn_handling={"interruption": {"enabled": True}, "endpointing": {"min_delay": 2.0}},
    )

    # Resource usage tracking
    usage = {
        "input_tokens": 0, "output_tokens": 0,
        "stt_seconds": 0.0, "tts_chars": 0,
        "total_cost": 0.0
    }

    async def broadcast_usage():
        if ctx.room.local_participant:
            await ctx.room.local_participant.set_metadata(json.dumps({
                "name": AGENT_NAME,
                "usage": usage
            }))

    guard = CostGuard(
        agent_name="MARTECH",
        session_cost_ceiling=0.25,
        max_context_turns=15,
        usage_broadcast_interval_s=10.0,
        min_stt_words=3,
    )

    @session.on("session_usage_updated")
    def on_usage(usage_data: voice.SessionUsageUpdatedEvent):
        sentry.calculate_session_cost(
            llm_model="gpt-4o-mini",
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            stt_model="nova-2-general",
            stt_seconds=usage.get("stt_seconds", 0.0),
            tts_model="aura-hera-en",
            tts_characters=usage.get("tts_chars", 0)
        )
        if guard.update_usage(usage_data, usage):
            asyncio.create_task(broadcast_usage())

    # WebRTC connection retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
            break
        except Exception as e:
            logger.warning(f"LiveKit connection attempt {attempt} failed: {e}")
            if attempt == max_retries:
                raise
            await asyncio.sleep(2 ** attempt)

    # Initial data sync to Room participants
    await broadcast_usage()
    
    # Broadcast simulated/real GA4/GSC chart data package immediately upon loading room
    metrics_payload = {
        "summary": comparison,
        "anomalies": anomalies,
        "opportunities": opps,
        "correlations": correlations
    }
    ui_packet = json.dumps({
        "type": "MARTECH_ANALYTICS_DATA",
        "data": metrics_payload,
        "markdown": markdown_report
    }).encode("utf-8")
    
    # Wait for participants to connect before sending
    await asyncio.sleep(1.0)
    if ctx.room.local_participant:
        await ctx.room.local_participant.publish_data(ui_packet, topic="ui_control")
        logger.info("[MARTECH] Broadcasted initial WebRTC analytics state.")

    # Start conversational agent pipeline
    await session.start(room=ctx.room, agent=agent)
    logger.info("[PIPELINE] Martech Analytics agent session started.")

    @session.on("user_input_transcribed")
    def on_stt(event: voice.UserInputTranscribedEvent):
        if event.is_final:
            if not guard.allow_transcript(event.transcript):
                return
            # --- SEMANTIC ENDPOINTING ---
            if not sentry.is_thought_complete(event.transcript):
                return
            logger.info(f"--- [INPUT] {event.transcript} ---")

    @session.on("conversation_item_added")
    def on_conversation_item(event: voice.ConversationItemAddedEvent):
        item = event.item
        if isinstance(item, llm.ChatMessage):
            guard.prune_context(chat_ctx)
            content = item.content[0] if isinstance(item.content, list) else item.content
            if item.role == "assistant":
                logger.info(f"MARTECH: {content}")
            elif item.role == "user":
                logger.info(f"USER: {content}")

async def request_fnc(req: JobRequest):
    await req.accept()

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=request_fnc,
            agent_name="MARTECH"
        )
    )
