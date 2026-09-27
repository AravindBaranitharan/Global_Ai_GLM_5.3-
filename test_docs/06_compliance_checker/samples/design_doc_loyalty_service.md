# Design doc: Loyalty Points Service

Owner: Growth engineering · Status: ready for review

## Summary
Customers earn points on every order and redeem them at checkout. We also want to use points
activity to personalise offers, including for teenage customers who shop with the family account.

## Data we store
- Customer name, email, phone number, date of birth and full delivery address.
- Order history with amounts and items.
- Points balance and every earn/redeem event.
- We keep all loyalty data for 7 years after the account is closed, in case the customer returns.

## Architecture
- Loyalty API on Kubernetes in the Singapore region (ap-southeast-1), because it is closer to the
  analytics team's warehouse.
- PostgreSQL database; encryption at rest is "planned for Q2".
- Nightly export of raw customer emails and phone numbers to the marketing analytics tool so
  campaigns can target high-value customers.
- A third-party offers engine (vendor contract under negotiation) receives the full customer profile.
- Customer support can look up any customer's loyalty data; there is no access review.

## Personalisation
An LLM generates personalised offers. We send the customer's profile and last 50 orders to a
public AI API. Customers aged 13-17 get offers based on their browsing.

## Privacy
Marketing emails are sent to all loyalty members by default; they can unsubscribe by contacting support.
Deletion requests are handled manually by the support team when time allows.
Launch is planned in three weeks; a DPIA was not considered necessary.
