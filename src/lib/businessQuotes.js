/**
 * Daily Auto-Rotating Motivational Business & Entrepreneurship Quotes
 * Dynamically shifts every day at midnight based on the calendar day of the year.
 */

export const BUSINESS_QUOTES = [
  {
    quote: "The secret of business is to know something that nobody else knows.",
    author: "Aristotle Onassis",
    topic: "Strategy"
  },
  {
    quote: "If you don't build your dream, someone else will hire you to help them build theirs.",
    author: "Dhirubhai Ambani",
    topic: "Entrepreneurship"
  },
  {
    quote: "Quality is not an act, it is a habit. Pure water, pure commitment.",
    author: "Aristotle",
    topic: "Excellence"
  },
  {
    quote: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
    topic: "Execution"
  },
  {
    quote: "If you are not embarrassed by the first version of your product, you’ve launched too late.",
    author: "Reid Hoffman",
    topic: "Speed"
  },
  {
    quote: "Your most unhappy customers are your greatest source of learning.",
    author: "Bill Gates",
    topic: "Customer Focus"
  },
  {
    quote: "Take the stones people throw at you and use them to build a monument.",
    author: "Ratan Tata",
    topic: "Resilience"
  },
  {
    quote: "Price is what you pay. Value is what you get.",
    author: "Warren Buffett",
    topic: "Value"
  },
  {
    quote: "Speed matters in business. Many decisions and actions are reversible and do not need extensive study.",
    author: "Jeff Bezos",
    topic: "Agility"
  },
  {
    quote: "Operations isn't glamorous, but flawless execution is the backbone of every enterprise that survives.",
    author: "Sam Walton",
    topic: "Operations"
  },
  {
    quote: "Customer service is not a department, it's everyone's job.",
    author: "Anonymous",
    topic: "Service"
  },
  {
    quote: "Opportunities don't happen. You create them through sheer persistence.",
    author: "Chris Grosser",
    topic: "Perseverance"
  },
  {
    quote: "Consistency is what transforms average into excellence.",
    author: "Tony Dungy",
    topic: "Consistency"
  },
  {
    quote: "Never take your eyes off the cash flow because it's the life blood of business.",
    author: "Sir Richard Branson",
    topic: "Cash Flow"
  },
  {
    quote: "The only limit to our realization of tomorrow will be our doubts of today.",
    author: "Franklin D. Roosevelt",
    topic: "Vision"
  },
  {
    quote: "Great things in business are never done by one person. They're done by a team of people.",
    author: "Steve Jobs",
    topic: "Teamwork"
  },
  {
    quote: "Success usually comes to those who are too busy to be looking for it.",
    author: "Henry David Thoreau",
    topic: "Dedication"
  },
  {
    quote: "Don’t find customers for your products, find products for your customers.",
    author: "Seth Godin",
    topic: "Marketing"
  },
  {
    quote: "In the middle of difficulty lies opportunity.",
    author: "Albert Einstein",
    topic: "Optimism"
  },
  {
    quote: "A satisfied customer is the best business strategy of all.",
    author: "Michael LeBoeuf",
    topic: "Customer Retention"
  },
  {
    quote: "You don't need a 100-person company to develop that cool idea.",
    author: "Larry Page",
    topic: "Innovation"
  },
  {
    quote: "Discipline is the bridge between goals and accomplishment.",
    author: "Jim Rohn",
    topic: "Discipline"
  },
  {
    quote: "Chase the vision, not the money; the money will end up following you.",
    author: "Tony Hsieh",
    topic: "Purpose"
  },
  {
    quote: "There are no secrets to success. It is the result of preparation, hard work, and learning from failure.",
    author: "Colin Powell",
    topic: "Success"
  },
  {
    quote: "When you build trust with your community, business stops being a transaction and becomes a mission.",
    author: "Mittal Brothers Philosophy",
    topic: "Trust & Community"
  },
  {
    quote: "Timely delivery is not just logistics; it is keeping a sacred promise to every doorstep.",
    author: "Enterprise Logistics Creed",
    topic: "Punctuality"
  },
  {
    quote: "Profit is like oxygen, food, water, and blood for the body; they are not the point of life, but without them, there is no life.",
    author: "Jim Collins",
    topic: "Profitability"
  },
  {
    quote: "Measure what is measurable, and make measurable what is not so.",
    author: "Galileo Galilei",
    topic: "Metrics"
  },
  {
    quote: "Turn each customer complaint into an opportunity to build lifetime loyalty.",
    author: "Shep Hyken",
    topic: "Customer Loyalty"
  },
  {
    quote: "The true entrepreneur is a doer, not a dreamer.",
    author: "Nolan Bushnell",
    topic: "Action"
  },
  {
    quote: "Focus on being productive instead of busy.",
    author: "Tim Ferriss",
    topic: "Efficiency"
  },
  {
    quote: "Leadership is the capacity to translate vision into reality.",
    author: "Warren Bennis",
    topic: "Leadership"
  },
  {
    quote: "Do what you do so well that they will want to see it again and bring their friends.",
    author: "Walt Disney",
    topic: "Referral Growth"
  },
  {
    quote: "Supply chain excellence turns ordinary businesses into formidable market leaders.",
    author: "Logistics Axiom",
    topic: "Supply Chain"
  },
  {
    quote: "Small daily improvements over time lead to stunning long-term results.",
    author: "Robin Sharma",
    topic: "Kaizen"
  },
  {
    quote: "Always deliver more than expected.",
    author: "Larry Page",
    topic: "Overdelivering"
  }
];

/**
 * Returns today's dynamic motivational quote based on day-of-year.
 * Automatically shifts at 00:00:00 local time every day.
 */
export function getDailyBusinessQuote(date = new Date()) {
  try {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const index = Math.abs(dayOfYear) % BUSINESS_QUOTES.length;
    return BUSINESS_QUOTES[index];
  } catch {
    return BUSINESS_QUOTES[0];
  }
}
