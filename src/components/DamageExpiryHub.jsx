import React from 'react';
import DamageReturnHub from './damage/DamageReturnHub';

/**
 * DamageExpiryHub Component
 * Directly renders the Damage & Expiry Management Hub with live Realtime subscriptions
 * on `damage_expiry_items` and `product_damages`.
 */
export function DamageExpiryHub(props) {
  return <DamageReturnHub {...props} />;
}

export { DamageReturnHub };
export default DamageExpiryHub;
