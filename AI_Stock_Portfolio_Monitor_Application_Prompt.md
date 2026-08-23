# AI Stock Portfolio Monitor — Complete Application Development Prompt

> **Core product:** My Stocks + 5% Alerts + AI When I Ask

Build a modern, simple, responsive stock portfolio monitoring application focused on one purpose: users add the stocks they own, monitor performance, receive automatic notifications whenever a stock crosses each 5% movement threshold, and optionally ask an AI Analyst to analyze a specific stock's current news, sentiment, and potential direction.

This is **not a trading platform**. Keep the MVP intentionally simple. Do not create Markets, Watchlist, Risk, Scenario, Trading, Orders, Broker Integration, Options, Crypto, Mutual Funds, complex portfolio planning, or social/community modules.

## 1. Product Vision

The application should feel like a **personal stock monitoring assistant**, not a stock trading terminal.

The primary user journey is:

```text
Open Application
       ↓
Click "Money"
       ↓
Portfolio Dashboard
       ↓
Add Owned Stock
       ↓
Enter Stock Symbol
       ↓
Enter Number of Shares
       ↓
Enter Bought Price
       ↓
Save
       ↓
Application continuously monitors stock price
       ↓
Price crosses ±5% threshold
       ↓
Send Notification
       ↓
User opens stock
       ↓
Views performance
       ↓
Optionally asks AI Analyst
       ↓
AI retrieves current relevant information
       ↓
AI provides sentiment + factors + potential direction
       ↓
User decides what to do
```

The dashboard should immediately answer:

1. What stocks do I own?
2. What did I pay?
3. What are they worth now?
4. How much am I up/down?
5. Has a new 5% threshold been crossed?
6. What changed?
7. Do I want to ask AI?

## 2. Product Name

Working name: **Money**

The landing page should have one prominent CTA:

**Enter Money**

After clicking it, the user enters the application dashboard.

Branding should feel:

- Premium
- Modern
- Trustworthy
- Minimal
- Financial
- AI-powered
- Easy for non-professional investors

Avoid an overly complicated banking-style interface.

## 3. Authentication

Implement:

- Email/password registration and login
- Google Sign-In if practical
- Secure logout
- Forgot password
- Session persistence
- Protected application routes

Flow:

```text
Login
 ↓
Money Dashboard
```

Do not create a complicated onboarding process.

## 4. Navigation

Keep navigation extremely small.

### Desktop

- Money
- Notifications
- Profile / Settings

### Mobile

- Money
- Notifications
- Profile

Do not add unnecessary navigation.

## 5. Money Dashboard

The dashboard is the primary screen.

Example header:

```text
Good afternoon, [User]

Your Money
Monitor your investments and stay informed.
```

Portfolio summary:

```text
TOTAL INVESTED
$25,420.00

CURRENT VALUE
$27,815.50

TOTAL GAIN
+$2,395.50

+9.42%
```

Use clear visual indicators for positive and negative movement.

### Stock Card

Each owned stock should display:

```text
AAPL
Apple Inc.

Shares
25

Average Cost
$180.00

Current Price
$195.40

Investment
$4,500.00

Current Value
$4,885.00

Gain
+$385.00
+8.56%

● +5% Alert Triggered

[ Ask AI Analyst ]
```

Include:

- Symbol
- Company name
- Shares
- Average purchase price
- Current price
- Total invested
- Current value
- Dollar gain/loss
- Percentage gain/loss
- Latest movement
- Last notification
- Ask AI Analyst button

## 6. Add Stock

Provide a prominent:

**+ Add Stock**

Open a simple modal.

Fields:

### Stock Symbol

Example:

```text
AAPL
```

Use autocomplete/search to identify the company.

Display:

```text
Apple Inc.
NASDAQ
AAPL
```

### Number of Shares

Example:

```text
25
```

### Bought Price

Example:

```text
$180.00
```

### Purchase Date

Optional but recommended.

Button:

**Add Stock**

After saving, immediately add it to the user's portfolio.

## 7. Multiple Purchases / Average Cost

Support multiple purchases of the same stock.

Example:

```text
AAPL
10 shares @ $170

AAPL
15 shares @ $180
```

Calculate:

```text
Total Shares = 25
Average Cost = weighted average purchase price
```

The user should not manually calculate average cost.

Use a transaction model internally so future edits/sales can be supported cleanly.

## 8. Stock Monitoring Engine

This is the most important backend feature.

The system must continuously monitor the current price of every stock in active user portfolios.

Use:

```text
Current Price
vs
Investment Reference Price
```

Primary alert thresholds are every 5%.

Example with a $100 reference:

```text
$95  → -5%
$90  → -10%
$85  → -15%

$105 → +5%
$110 → +10%
$115 → +15%
```

Trigger an alert only when a **new threshold is crossed**.

## 9. Alert Behavior

Do not notify on every price update.

Example:

```text
100
104
105
106
107
108
109
110
```

Notify at:

```text
+5%
+10%
```

Do not notify at:

```text
+5.1%
+5.5%
+6%
+7%
...
```

The backend must deduplicate alerts.

## 10. Downward Alerts

For a $100 reference:

```text
99
97
95
```

Trigger:

```text
AAPL dropped 5%

Current Price: $95.00
Reference Price: $100.00
Movement: -5%

Tap to view your investment.
```

Continue with:

```text
-10%
-15%
-20%
...
```

## 11. Upward Alerts

For a $100 reference:

```text
AAPL increased 5%

Current Price: $105.00
Reference Price: $100.00
Movement: +5%
```

Continue with:

```text
+10%
+15%
+20%
...
```

## 12. Threshold Crossing Algorithm

The system must detect actual crossings, not simply current state.

Example:

```text
Previous Price = $104
New Price = $106
```

This crosses +5%.

Trigger:

```text
+5% notification
```

If price jumps:

```text
$104 → $116
```

It crossed:

```text
+5%
+10%
+15%
```

Prefer one consolidated notification to avoid spam:

```text
AAPL moved +16%

You crossed:
+5%
+10%
+15%

Current Price: $116
```

The threshold engine should compare the previous movement level with the current movement level.

## 13. Alert State

Store alert state independently from portfolio gain/loss.

Recommended fields:

```text
reference_price
last_up_threshold
last_down_threshold
last_checked_price
updated_at
```

This is important because the average purchase price may change when users add more shares.

The user's average purchase price is the primary reference for displaying investment performance, while alert state is maintained separately.

## 14. Notification Center

Create a simple notification page.

Example:

```text
Notifications

Today

🔼 AAPL +5%
Apple crossed your +5% movement threshold.

2:45 PM

🔽 TSLA -10%
Tesla crossed your -10% movement threshold.

11:20 AM

Yesterday

🔼 NVDA +15%
NVIDIA crossed your +15% movement threshold.
```

Notifications must be:

- Timestamped
- Stock-specific
- Direction-specific
- Read/unread
- Clickable

Clicking one opens the relevant stock.

## 15. Push / Email Notifications

Support where technically possible:

1. In-app notifications
2. Browser push
3. Email
4. Mobile push later

Settings:

```text
5% Movement Alerts    ON
Email Alerts          ON
Push Notifications    ON
```

Keep notification settings simple.

## 16. Stock Detail

Clicking a stock opens a focused detail page.

Example:

```text
AAPL
Apple Inc.

$195.40
+8.56%

Your Investment
$4,500

Current Value
$4,885

Gain
+$385
```

Include a simple price chart showing:

- Bought/reference price
- Current price
- 5% thresholds
- Recent historical movement

Do not build a professional trading terminal.

## 17. AI Analyst

AI Analyst is optional and user-triggered.

**Do not automatically run AI analysis every time the price changes.**

On the stock page:

**Ask AI Analyst**

Open an AI analysis interface.

Example:

```text
AI Analyst

What would you like to know about AAPL?

[ Ask AI Analyst... ]

Suggested questions:

• Why is AAPL moving today?
• Is the latest news positive or negative?
• What are the major risks?
• What could cause the stock to fall?
• Summarize today's AAPL news.
```

## 18. AI News Analysis

When the user asks the AI Analyst, retrieve relevant current information such as:

- Recent company news
- Earnings announcements
- Company announcements
- Product announcements
- Regulatory developments
- SEC/company filings where appropriate
- Major market-moving events
- Relevant macroeconomic information
- Analyst-related information where legally/licensed data permits

Then analyze the information.

## 19. AI Sentiment

Classify information as:

### Positive

Examples:

- Strong earnings
- Revenue growth
- Major contract
- Positive guidance
- Product success

### Negative

Examples:

- Weak earnings
- Revenue decline
- Regulatory issues
- Lawsuits
- Leadership concerns
- Negative guidance

### Neutral

When the available information does not clearly support either direction.

## 20. AI Analyst Response

Do not let the AI simply say:

> Buy this stock.

Use structured analysis.

Example:

```text
AAPL AI ANALYSIS

Overall Sentiment
🟢 Positive

Confidence
78%

Why?

1. Strong recent revenue performance.
2. Services business continues to grow.
3. Recent product demand remains strong.

Potential Positive Factors

• Revenue growth
• Strong services business
• Product demand

Potential Negative Factors

• Valuation concerns
• Regulatory pressure
• Geographic market uncertainty

Potential Direction

Positive Bias

Key Risks

Unexpected earnings weakness or regulatory developments.

Summary

The latest available information is generally positive,
but several risks remain.
```

## 21. AI Prediction Rules

The AI may provide a directional bias, but must not present predictions as guaranteed outcomes.

Use:

```text
Potential Direction

Positive Bias
Neutral
Negative Bias

Confidence: 72%
```

Preferred wording:

> Based on the available information, the current sentiment shows a positive bias.

Avoid:

> The stock will increase tomorrow.

Always communicate uncertainty.

## 22. AI Context

Provide the AI with relevant portfolio context:

```text
Stock: AAPL
Shares: 25
Average Cost: $180
Current Price: $195
Current Gain: +8.33%
Latest Movement: +5%
Recent News: [retrieved information]
```

This allows contextual analysis.

The AI should not automatically recommend selling or buying.

## 23. AI Questions

Support free-form questions such as:

```text
Why did Tesla drop today?

Is the latest NVIDIA news positive?

What happened with Apple today?

What are the biggest risks for Microsoft?

Why is this stock rising?

Summarize the latest news.

Is today's movement supported by company news?

What could cause this stock to fall further?
```

## 24. AI Sources

Where possible, display sources used for the answer.

Prioritize:

- Company investor relations
- SEC filings
- Reputable financial news organizations
- Licensed financial-data providers

Sources should be clickable.

Never fabricate sources.

If reliable current information cannot be retrieved, say so clearly.

## 25. AI Hallucination Protection

The AI must never invent:

- News
- Earnings
- Prices
- Analyst ratings
- SEC filings
- Company announcements
- Financial statistics
- Sources

If information is unavailable:

```text
Information unavailable
```

is better than fabricated information.

## 26. AI Trigger and Cost Control

Do NOT run:

```text
Every 5 minutes
→ retrieve news
→ run AI
→ analyze
→ notify
```

Instead:

```text
User clicks "Ask AI Analyst"
        ↓
Retrieve relevant current information
        ↓
Analyze
        ↓
Return result
```

This reduces cost, complexity, false alerts, and unnecessary notifications.

## 27. Portfolio Calculations

For each holding:

```text
Total Investment
= Shares × Average Purchase Price

Current Value
= Shares × Current Price

Profit/Loss
= Current Value - Total Investment

Profit/Loss %
= ((Current Price - Average Purchase Price)
   / Average Purchase Price) × 100
```

Portfolio totals:

```text
Total Invested
= Sum of all stock investments

Current Portfolio Value
= Sum of current stock values

Total Gain/Loss
= Current Value - Total Invested
```

## 28. Empty Dashboard

If there are no holdings:

```text
Your Money

Start monitoring your investments.

Add the stocks you already own and we'll
track their price movements for you.

[ + Add Your First Stock ]
```

## 29. Profile / Settings

Keep only necessary settings.

### Account

- Name
- Email
- Profile image
- Password
- Logout

### Notifications

```text
Price Movement Alerts    ON
Push Notifications       ON
Email Notifications      ON
```

### AI

```text
AI Analysis
Enabled
```

### Privacy

Include basic privacy controls.

Do not create a large settings system.

## 30. Database Design

Use a clean relational or document database.

Preferred entities:

### Users

```text
id
name
email
password_hash
created_at
updated_at
```

### Portfolios

```text
id
user_id
name
created_at
updated_at
```

A user can initially have one default portfolio.

### Holdings

```text
id
portfolio_id
symbol
company_name
shares
average_purchase_price
total_invested
current_price
current_value
profit_loss
profit_loss_percentage
created_at
updated_at
```

### Transactions

```text
id
holding_id
transaction_type
shares
price
transaction_date
created_at
```

Example:

```text
BUY
10
170
2026-01-10
```

### Alert State

```text
id
holding_id
reference_price
last_up_threshold
last_down_threshold
last_checked_price
updated_at
```

### Notifications

```text
id
user_id
holding_id
type
direction
threshold_percentage
price
message
is_read
created_at
```

### AI Analysis

```text
id
user_id
holding_id
question
sentiment
confidence
analysis
created_at
```

## 31. Market Data Architecture

Do not scrape stock websites directly.

Create an abstraction:

```text
MarketDataService
       ↓
Provider Adapter
       ↓
Stock Price API
```

Support:

```text
getCurrentPrice(symbol)
getCompanyInformation(symbol)
getHistoricalPrices(symbol)
```

Use a reputable, appropriately licensed market-data provider.

Use environment variables:

```env
MARKET_DATA_API_KEY=
MARKET_DATA_PROVIDER=
```

Never hard-code provider credentials.

## 32. Server-Side Price Monitoring

Monitoring must work even when the user's browser is closed.

Architecture:

```text
Scheduled Job
      ↓
Get unique active symbols
      ↓
Fetch latest prices
      ↓
Calculate movements
      ↓
Check 5% thresholds
      ↓
Create notifications
      ↓
Send push/email
      ↓
Update alert state
```

The browser should only display data.

## 33. Monitoring Frequency

For MVP, design the system around:

```text
Every 5–15 minutes during relevant market hours
```

The architecture should support more real-time data later.

Do not assume tick-level data is required.

## 34. Market Hours

The monitoring service should understand:

- Market open
- Market close
- Weekends
- Holidays
- Pre-market/after-hours when supported by the selected provider

For MVP, standard market hours are sufficient.

## 35. Notification Deduplication

If:

```text
AAPL crosses +5%
```

create one alert.

If the price remains above +5% for many updates:

```text
DO NOT notify again.
```

Only create another notification when a new threshold is crossed.

## 36. Alert Direction Changes

Example:

```text
Reference = $100

105 → +5%
110 → +10%
103
97 → -3%
95 → -5%
```

The system must correctly trigger the new -5% threshold.

Build this as a robust threshold state machine.

## 37. UX Design

The UI should feel like a premium modern fintech application.

Principles:

- Minimal
- Clean
- Spacious
- High readability
- Responsive
- Mobile-first
- Professional
- Subtle animations
- Clear typography
- Strong visual hierarchy

Avoid:

- Overloaded dashboards
- Excessive charts
- Dark trading-terminal aesthetics
- Too many cards
- Excessive colors
- Complicated navigation

## 38. Color System

Recommended:

- Neutral background
- White/soft cards
- Dark typography
- Green for gains
- Red for losses
- Amber/orange for warnings
- One subtle brand accent

Do not make the entire application green.

## 39. Responsive Design

Support:

- Desktop
- Laptop
- Tablet
- Mobile

Mobile should be intentionally designed, not merely compressed.

Mobile order:

```text
Portfolio Summary
      ↓
Stocks
      ↓
Stock Cards
      ↓
Notifications
```

Make Add Stock easy to access.

## 40. Animations

Use subtle animations for:

- Price updates
- Notification arrival
- Card hover
- Modal opening
- AI response loading
- Positive/negative movement

Avoid excessive animation.

## 41. Error Handling

### Invalid Symbol

```text
We couldn't find that stock.
Please check the symbol and try again.
```

### Market Data Failure

```text
Current price unavailable.
We'll try again shortly.
```

### AI Failure

```text
AI Analyst is temporarily unavailable.
Please try again.
```

Never expose raw API errors.

## 42. Security

Implement:

- Secure authentication
- Password hashing
- JWT/session security
- API authentication
- Rate limiting
- Input validation
- Server-side authorization
- Secure environment variables
- Protection against unauthorized portfolio access
- HTTPS
- Database access controls

Users must only access their own portfolio data.

## 43. REST API Structure

Example:

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/portfolio
POST   /api/portfolio/holdings
GET    /api/portfolio/holdings
GET    /api/portfolio/holdings/:id
PUT    /api/portfolio/holdings/:id
DELETE /api/portfolio/holdings/:id

GET    /api/stocks/:symbol
GET    /api/stocks/:symbol/history

GET    /api/notifications
PUT    /api/notifications/:id/read

POST   /api/ai/analyze
GET    /api/ai/history/:holdingId

GET    /api/settings
PUT    /api/settings
```

## 44. AI Service Architecture

Create a dedicated:

```text
AIAnalystService
```

Responsibilities:

```text
analyzeStock()
analyzeNews()
calculateSentiment()
summarizeNews()
identifyPositiveFactors()
identifyNegativeFactors()
generateOutlook()
```

Keep AI logic out of UI components and controllers.

## 45. Recommended Technology Stack

### Frontend

- React
- TypeScript
- Vite or Next.js
- Tailwind CSS
- Modern component library
- Recharts or equivalent

### Backend

Either:

- Node.js + Express.js

or:

- Next.js server/API architecture

### Database

Preferred:

- PostgreSQL

Alternative:

- MongoDB

### Authentication

- Secure session/JWT authentication
- Google OAuth if implemented

### Background Jobs

- Cron
- Queue worker
- Scheduled server jobs

For production scalability, consider:

- Redis
- BullMQ

### Notifications

- Web Push
- Email

### AI

Use a modern LLM API through a dedicated backend service.

### Market Data

Use a licensed/reputable financial market-data API.

## 46. Project Architecture

Use clean separation:

```text
src/

frontend/
    components/
    pages/
    layouts/
    hooks/
    services/
    types/

backend/
    controllers/
    services/
    repositories/
    models/
    middleware/
    jobs/
    notifications/
    ai/
    market-data/

database/
    migrations/
    seeds/

shared/
    types/
    constants/
    utilities/
```

Separate:

```text
UI
Business Logic
Database
Market Data
AI
Notifications
Background Jobs
```

Do not build everything in a single file.

## 47. Core Business Logic

Create reusable functions:

```text
calculateAverageCost()
calculatePortfolioValue()
calculateProfitLoss()
calculatePercentageChange()
calculateThresholds()
detectThresholdCrossing()
createPriceAlert()
sendNotification()
analyzeStockWithAI()
```

Write unit tests for these functions.

## 48. Threshold Algorithm

Given:

```text
referencePrice = 100
currentPrice = 116
```

Movement:

```text
+16%
```

Current threshold:

```text
floor(16 / 5) × 5 = +15%
```

For:

```text
currentPrice = 83
```

Movement:

```text
-17%
```

Current threshold:

```text
-15%
```

Compare previous and current threshold levels to detect crossings. Never repeatedly trigger the same threshold.

## 49. Add / Edit / Remove Stock

Users can:

### Add

```text
AAPL
25 shares
$180 average purchase price
```

### Edit

Allow changes to:

- Shares
- Purchase information

### Delete

Confirm:

```text
Remove AAPL from your portfolio?

This will stop monitoring and notifications
for this stock.

[Cancel] [Remove]
```

## 50. Portfolio Sorting

Keep simple:

- Highest gain
- Biggest loss
- Alphabetical
- Recently added

Do not build advanced filters.

## 51. Stock Search

Only provide search where necessary:

```text
Search stock symbol or company
```

Do not create global market search.

## 52. Explicitly Do NOT Build

### No Watchlist

Only owned stocks are monitored.

### No Markets Page

Do not build:

- Market overview
- Top gainers
- Top losers
- Trending stocks
- Market indices

### No Risk Module

Do not create a separate risk score. AI can mention risks when relevant.

### No Scenario Module

Do not build:

- What-if simulations
- Scenario planning
- Portfolio forecasting tools

### No Automatic AI Notifications

MVP:

```text
Price movement → automatic notification

AI analysis → only when user asks
```

## 53. Notification Examples

### Down

```text
🔴 AAPL dropped 5%

Apple is now $171.20.

Your average purchase price:
$180.00

Movement:
-5%

[View AAPL]
```

### Up

```text
🟢 AAPL increased 5%

Apple is now $189.10.

Your average purchase price:
$180.00

Movement:
+5%

[View AAPL]
```

Use the actual threshold that was crossed. Do not misleadingly round arbitrary price movements.

## 54. AI Example

User asks:

> Why is AAPL down today?

Possible structured response:

```text
AAPL AI ANALYST

Overall Sentiment
🟡 Neutral to Negative

Current Bias
Negative

Confidence
71%

What is happening?

AAPL is under pressure today primarily due to
recent concerns identified in the retrieved sources.

Positive Factors

• Strong services performance
• Healthy cash position

Negative Factors

• Recent regulatory concerns
• Weakness in relevant business areas

Potential Direction

Cautious short-term outlook

For your position:

Average cost: $180
Current price: $171
Position: -5%

Review the underlying news and your investment
strategy before making a decision.

AI analysis is informational only and is not
financial advice.
```

## 55. Financial Disclaimer

Display a small disclaimer:

```text
Money provides investment monitoring and AI-generated
information for educational purposes only. It does not
provide financial, investment, tax, or legal advice.
```

AI predictions must never be represented as guaranteed outcomes.

## 56. Performance

Use:

- API caching
- Efficient database queries
- Background market-data processing
- Lazy loading
- Pagination where appropriate
- Debounced stock search
- Optimized notification queries

Do not request market data separately for every UI component.

## 57. Scalability

Design for:

```text
100 users
→ 1,000 users
→ 10,000 users
→ 100,000+ users
```

If 500 users own AAPL, do not make 500 separate market-data requests.

Instead:

```text
Fetch AAPL once
      ↓
Cache price
      ↓
Update all users holding AAPL
```

## 58. Background Monitoring Optimization

Use:

```text
All unique symbols
        ↓
Fetch prices in batches
        ↓
Cache current prices
        ↓
Find users holding each symbol
        ↓
Calculate movement
        ↓
Detect threshold
        ↓
Create notifications
        ↓
Send notifications
```

## 59. Audit Logging

Track:

```text
Stock Added
Stock Removed
Price Alert Triggered
Notification Sent
AI Analysis Requested
AI Analysis Completed
```

## 60. Testing Requirements

### Authentication

- Register
- Login
- Logout
- Unauthorized access

### Portfolio

- Add stock
- Edit stock
- Delete stock
- Multiple purchases
- Average cost calculation

### Calculations

- Profit/loss
- Percentage movement
- Portfolio totals

### Alerts

- +5%
- +10%
- +15%
- -5%
- -10%
- -15%
- Threshold crossing
- Duplicate prevention
- Large price jumps
- Direction changes

### AI

- Stock analysis request
- News unavailable
- API failure
- Invalid stock
- Source handling

## 61. MVP Scope

The first production version should contain ONLY:

### Authentication

- Login
- Register
- Logout

### Money Dashboard

- Portfolio summary
- Owned stocks
- Current prices
- Gain/loss

### Stock Management

- Add stock
- Edit stock
- Delete stock
- Multiple purchases

### Monitoring

- 5% upward alerts
- 5% downward alerts

### Notifications

- In-app
- Push/email where supported

### Stock Detail

- Current price
- Investment information
- Simple chart
- Alert history

### AI Analyst

- Ask AI about a specific owned stock
- Current news analysis
- Positive/negative/neutral sentiment
- Potential direction
- Risks
- Sources

### Settings

- Notification preferences
- Account settings

Nothing more.

## 62. Future Features — Do Not Build Now

Keep the architecture extensible for:

- Broker integration
- Automatic portfolio synchronization
- Mobile application
- AI proactive alerts
- Tax reporting
- Dividend tracking
- Earnings calendar
- Advanced portfolio analytics
- Multiple portfolios
- Crypto
- ETF support
- Watchlists
- Advanced risk analysis
- Scenario planning

These must not appear in MVP navigation.

## 63. Visual Design

The UI should feel like:

```text
Modern fintech
+
Personal investment dashboard
+
AI assistant
```

Experience target:

**Simple enough for a beginner, sophisticated enough for an experienced investor.**

Use:

- Rounded cards
- Clean typography
- Strong spacing
- Subtle shadows
- Minimal icons
- Clear price typography
- Small charts
- Elegant notification indicators

Avoid:

- Bloomberg-style interfaces
- Excessive tables
- Dense financial terminology
- Too many charts
- Excessive dashboards
- Complex menus

## 64. Landing Page

Hero:

```text
Know When Your Stocks Move.

Monitor your investments.
Get notified every 5%.
Ask AI when you need answers.

[ Enter Money ]
```

Supporting message:

```text
Add the stocks you own.
Set your investment reference.
We'll monitor the movement for you.
```

Feature cards:

```text
5% Movement Alerts
Know when your stocks move significantly.

Your Portfolio
Track exactly what you own and what you've gained.

AI Analyst
Ask about your stock whenever you need current
news and analysis.
```

## 65. Product Philosophy

The application should answer:

> "I own these stocks. Tell me when something meaningful happens."

Not:

> "Show me everything happening in the stock market."

Core flow:

```text
OWNED STOCKS
     ↓
MONITOR
     ↓
5% ALERT
     ↓
USER DECIDES
     ↓
ASK AI IF NEEDED
```

This must remain the central product philosophy.

## 66. Final Screens

Approximately:

```text
1. Landing Page
2. Login
3. Register
4. Money Dashboard
5. Add Stock Modal
6. Stock Detail
7. AI Analyst
8. Notifications
9. Settings
```

Do not expand the MVP into unnecessary modules.

## 67. Deliverables

Build a complete end-to-end application, not just a UI prototype.

### Frontend

- Complete responsive UI
- Authentication
- Dashboard
- Stock cards
- Add/edit/delete stock
- Notifications
- Stock detail
- AI Analyst interface
- Settings

### Backend

- Authentication APIs
- Portfolio APIs
- Stock APIs
- Market data service
- Monitoring engine
- Threshold engine
- Notification service
- AI Analyst service
- Background jobs

### Database

- Schema
- Migrations
- Seed data
- Indexes

### Integrations

- Market data provider
- AI provider
- Notification provider
- Email provider if implemented

### Testing

- Unit tests
- API tests
- Alert logic tests
- Authentication tests
- Portfolio calculation tests

### Documentation

Create:

```text
README.md
.env.example
API documentation
Database documentation
Deployment documentation
Architecture documentation
```

## 68. Environment Variables

Use `.env.example`:

```env
DATABASE_URL=

JWT_SECRET=

MARKET_DATA_API_KEY=
MARKET_DATA_PROVIDER=

AI_API_KEY=

EMAIL_API_KEY=

PUSH_NOTIFICATION_KEY=

APP_URL=
```

Never expose secrets in frontend code.

## 69. Deployment

Make the application production-ready and deployable on common cloud platforms.

Support:

- Frontend deployment
- Backend deployment
- PostgreSQL database
- Background worker
- Scheduled monitoring jobs
- Environment variables
- HTTPS
- Production logging

## 70. Demo Data

Create optional development/demo data:

```text
AAPL
25 shares
Average Cost: $180

NVDA
10 shares
Average Cost: $190

TSLA
15 shares
Average Cost: $320
```

This is only for development/demo environments.

Do not use fake data in production.

## 71. Code Quality

Follow:

- TypeScript strict mode
- Clean architecture
- SOLID principles where appropriate
- Reusable components
- Reusable services
- Input validation
- Error boundaries
- Centralized error handling
- Secure authentication
- Proper database indexes
- Meaningful naming
- No duplicated business logic

Do not create a huge monolithic component.

## 72. AI Coding Instructions

Act as an expert:

- Product designer
- UX designer
- Full-stack engineer
- Database architect
- Financial-data integration engineer
- AI application engineer

Do not merely generate a visual mockup.

Generate a fully functional end-to-end application.

Before implementation:

1. Define application architecture.
2. Define database schema.
3. Define API architecture.
4. Define stock monitoring architecture.
5. Define the 5% threshold algorithm.
6. Define notification architecture.
7. Define AI Analyst architecture.
8. Define frontend component architecture.

Then implement the application.

Prioritize functionality over unnecessary visual complexity.

If a third-party API requires credentials, use environment variables and provide configuration instructions.

Never hard-code API keys.

Never fabricate stock prices or news.

Never fabricate AI sources.

Use mock/demo data only when an external API is unavailable in development, and clearly separate mock providers from production providers.

## 73. Final Acceptance Criteria

The application is complete when this workflow works end-to-end:

```text
User opens application
        ↓
Clicks "Money"
        ↓
Logs in
        ↓
Sees Money Dashboard
        ↓
Clicks "+ Add Stock"
        ↓
Searches AAPL
        ↓
Selects Apple
        ↓
Enters 25 shares
        ↓
Enters $180 purchase price
        ↓
Saves
        ↓
AAPL appears in portfolio
        ↓
Current price is retrieved
        ↓
Gain/loss is calculated
        ↓
Background monitoring begins
        ↓
AAPL crosses +5%
        ↓
Notification is generated
        ↓
User receives notification
        ↓
User opens AAPL
        ↓
Sees current performance
        ↓
Clicks "Ask AI Analyst"
        ↓
Asks:
"Why is AAPL moving today?"
        ↓
System retrieves current relevant information
        ↓
AI analyzes the information
        ↓
AI provides:
- Sentiment
- Positive factors
- Negative factors
- Potential direction
- Confidence
- Sources
- Disclaimer
        ↓
User decides what action to take.
```

## 74. Most Important Requirement

Do not lose sight of the product's simplicity.

The application is fundamentally:

# "My Stocks + 5% Alerts + AI When I Ask"

Everything else should support those three things.

Do not turn this into:

- A stock trading platform
- A market news website
- A portfolio management suite
- A financial social network
- A complicated investment analytics system

The strongest version is a **simple personal investment monitoring assistant** that tells the user:

> **"Your stock moved 5%. Here is what happened. If you want to understand why, ask the AI Analyst."**

Build the MVP around that exact experience.
