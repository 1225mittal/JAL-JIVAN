import React from 'react';
import PurchaseInwardHub from './PurchaseInwardHub';

/**
 * InvoicesLedger Component
 * Directly renders the Purchase Invoices Ledger view with live Realtime subscriptions
 * on `purchase_invoices` and `purchase_items`.
 */
export function InvoicesLedger(props) {
  return <PurchaseInwardHub initialTab="history" {...props} />;
}

export { PurchaseInwardHub };
export default InvoicesLedger;
