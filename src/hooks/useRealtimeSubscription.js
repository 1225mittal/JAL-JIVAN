import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Universal Supabase Realtime Table Listener Hook
 *
 * Listens to `postgres_changes` on the `public` schema for one or more tables.
 * Automatically synchronizes React component state on:
 *   - INSERT: Prepend (default) or append new records into state
 *   - UPDATE: Find record by `id` (or custom primaryKey) and replace it in state
 *   - DELETE: Filter out record by `id` (or custom primaryKey) from state
 * Cleans up subscriptions with `supabase.removeChannel(channel)` on unmount.
 *
 * @param {Object|string|string[]} configOrTable - Configuration object or table name(s)
 * @param {Function} [maybeSetData] - State setter if using positional args: (table, setData, options)
 * @param {Object} [maybeOptions] - Additional options if using positional args
 * @returns {{ channel: Object|null, unsubscribe: Function, isSubscribed: boolean }}
 */
export function useRealtimeSubscription(configOrTable, maybeSetData, maybeOptions = {}) {
  // Normalize configuration whether called as object or positional arguments
  let config = {};
  if (typeof configOrTable === 'string' || Array.isArray(configOrTable)) {
    config = {
      table: configOrTable,
      setData: maybeSetData,
      ...maybeOptions
    };
  } else if (configOrTable && typeof configOrTable === 'object') {
    config = configOrTable;
  }

  const {
    table,
    schema = 'public',
    event = '*',
    filter = undefined,
    primaryKey = 'id',
    enabled = true,
    prepend = true,
    setData,
    onInsert,
    onUpdate,
    onDelete,
    onChange
  } = config;

  // Track subscription state
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelRef = useRef(null);

  // Keep callback refs stable to avoid unnecessary channel reconnections
  const callbacksRef = useRef({
    setData,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
    prepend,
    primaryKey
  });

  useEffect(() => {
    callbacksRef.current = {
      setData,
      onInsert,
      onUpdate,
      onDelete,
      onChange,
      prepend,
      primaryKey
    };
  }, [setData, onInsert, onUpdate, onDelete, onChange, prepend, primaryKey]);

  // Unsubscribe helper
  const unsubscribe = useCallback(() => {
    if (channelRef.current && supabase) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn('Realtime channel removal notice:', err);
      }
      channelRef.current = null;
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    // Check if realtime should run
    const isConfigValid = typeof isSupabaseConfigured === 'function'
      ? isSupabaseConfigured()
      : Boolean(isSupabaseConfigured);

    if (!enabled || !table || !isConfigValid || !supabase) {
      return;
    }

    // Support single table or array of tables
    const tableList = Array.isArray(table) ? table.filter(Boolean) : [table].filter(Boolean);
    if (tableList.length === 0) return;

    // Unique channel identifier per hook instance
    const channelName = `realtime-${tableList.join('_')}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // Register listener for each table
    tableList.forEach((currentTable) => {
      const changeConfig = {
        event,
        schema,
        table: currentTable
      };
      if (filter) {
        changeConfig.filter = filter;
      }

      channel.on('postgres_changes', changeConfig, (payload) => {
        const {
          setData: currentSetData,
          onInsert: currentOnInsert,
          onUpdate: currentOnUpdate,
          onDelete: currentOnDelete,
          onChange: currentOnChange,
          prepend: shouldPrepend,
          primaryKey: pkField
        } = callbacksRef.current;

        const eventType = payload.eventType;

        // 1. Automatic Component State Synchronization (if setData is provided)
        if (typeof currentSetData === 'function') {
          currentSetData((prevState) => {
            if (!Array.isArray(prevState)) return prevState;

            if (eventType === 'INSERT') {
              const newRecord = payload.new;
              if (!newRecord) return prevState;

              const newId = newRecord[pkField] ?? newRecord.id;
              // Check if already in state to avoid duplicate rendering
              const exists = newId !== undefined && newId !== null &&
                prevState.some((item) => String(item?.[pkField] ?? item?.id) === String(newId));

              if (exists) {
                return prevState.map((item) =>
                  String(item?.[pkField] ?? item?.id) === String(newId)
                    ? { ...item, ...newRecord }
                    : item
                );
              }
              return shouldPrepend ? [newRecord, ...prevState] : [...prevState, newRecord];
            }

            if (eventType === 'UPDATE') {
              const updatedRecord = payload.new;
              if (!updatedRecord) return prevState;

              const targetId = updatedRecord[pkField] ?? updatedRecord.id;
              if (targetId === undefined || targetId === null) return prevState;

              const exists = prevState.some((item) => String(item?.[pkField] ?? item?.id) === String(targetId));
              if (!exists) {
                // If not found in current state, append/prepend as appropriate
                return shouldPrepend ? [updatedRecord, ...prevState] : [...prevState, updatedRecord];
              }

              return prevState.map((item) =>
                String(item?.[pkField] ?? item?.id) === String(targetId)
                  ? { ...item, ...updatedRecord }
                  : item
              );
            }

            if (eventType === 'DELETE') {
              const deletedRecord = payload.old || payload.new;
              const deletedId = deletedRecord?.[pkField] ?? deletedRecord?.id;
              if (deletedId === undefined || deletedId === null) return prevState;

              return prevState.filter((item) => String(item?.[pkField] ?? item?.id) !== String(deletedId));
            }

            return prevState;
          });
        }

        // 2. Targeted Event Callbacks
        if (eventType === 'INSERT') {
          currentOnInsert?.(payload.new, { table: currentTable, payload, eventType });
        } else if (eventType === 'UPDATE') {
          currentOnUpdate?.(payload.new, { table: currentTable, payload, eventType });
        } else if (eventType === 'DELETE') {
          currentOnDelete?.(payload.old || payload.new, { table: currentTable, payload, eventType });
        }

        // 3. Generic Change Callback
        currentOnChange?.(payload, { table: currentTable, eventType });
      });
    });

    // Subscribe to channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsSubscribed(true);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsSubscribed(false);
      }
    });

    // Clean up subscriptions with supabase.removeChannel(channel) on unmount
    return () => {
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.warn('Realtime cleanup error:', err);
        }
      }
      channelRef.current = null;
      setIsSubscribed(false);
    };
  }, [enabled, schema, event, filter, JSON.stringify(Array.isArray(table) ? table : [table])]);

  return {
    channel: channelRef.current,
    unsubscribe,
    isSubscribed
  };
}

export default useRealtimeSubscription;
