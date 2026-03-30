/**
 * FHIR Platform Bridge v1.0
 * Cross-tab messaging layer using localStorage + BroadcastChannel
 * Works entirely in the browser — no server required.
 *
 * Architecture:
 *   Client  ──[submitOrder]──►  localStorage('fhir_orders')  ──►  Vendor (BroadcastChannel)
 *   Vendor  ──[sendReport]──►   localStorage('fhir_results')  ──►  Client (BroadcastChannel)
 *
 * Both platforms poll + listen via BroadcastChannel for instant delivery.
 */

(function(window) {
  'use strict';

  // ─────────────────────────────────────────────
  //  Storage keys
  // ─────────────────────────────────────────────
  const KEYS = {
    ORDERS:       'fhir_orders',
    RESULTS:      'fhir_results',
    FILES_META:   'fhir_files_meta',
    FILE_DATA:    'fhir_file_',     // prefix: fhir_file_<id>
    AUDIT:        'fhir_audit_log',
  };

  // ─────────────────────────────────────────────
  //  BroadcastChannel setup
  // ─────────────────────────────────────────────
  let orderChannel, resultChannel;
  try {
    orderChannel  = new BroadcastChannel('fhir_orders_channel');
    resultChannel = new BroadcastChannel('fhir_results_channel');
  } catch(e) {
    // Fallback: storage events only (Safari private mode)
    orderChannel  = { postMessage: ()=>{}, onmessage: null };
    resultChannel = { postMessage: ()=>{}, onmessage: null };
  }

  // ─────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e) {
      console.error('[FHIR Bridge] Storage write failed:', e);
      return false;
    }
  }
  function genId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
  }
  function now() { return new Date().toISOString(); }
  function addAudit(entry) {
    const log = readJSON(KEYS.AUDIT);
    log.unshift({ ...entry, timestamp: now() });
    if (log.length > 200) log.length = 200;
    writeJSON(KEYS.AUDIT, log);
  }

  // ─────────────────────────────────────────────
  //  FILE STORE  (base64 in localStorage)
  //  Max ~4MB per file (localStorage 5–10MB total)
  // ─────────────────────────────────────────────
  function storeFile(file) {
    return new Promise((resolve, reject) => {
      const id = genId('FILE');
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target.result;
        try {
          localStorage.setItem(KEYS.FILE_DATA + id, dataUrl);
          const meta = {
            id, name: file.name, type: file.type || detectMime(file.name),
            size: file.size, storedAt: now()
          };
          const allMeta = readJSON(KEYS.FILES_META);
          allMeta.push(meta);
          writeJSON(KEYS.FILES_META, allMeta);
          resolve(meta);
        } catch(e) {
          reject(new Error('File too large for browser storage (max ~4MB). Use chunked upload for larger DICOM series.'));
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  function getFileData(id) {
    return localStorage.getItem(KEYS.FILE_DATA + id) || null;
  }

  function deleteFile(id) {
    localStorage.removeItem(KEYS.FILE_DATA + id);
    const meta = readJSON(KEYS.FILES_META).filter(f => f.id !== id);
    writeJSON(KEYS.FILES_META, meta);
  }

  function downloadFile(id, filename) {
    const data = getFileData(id);
    if (!data) { alert('File not found in storage.'); return; }
    const a = document.createElement('a');
    a.href = data;
    a.download = filename || id;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function detectMime(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
      pdf:'application/pdf', dcm:'application/dicom',
      jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
      gif:'image/gif', tiff:'image/tiff',
      hl7:'text/plain', xml:'application/xml',
      json:'application/json', txt:'text/plain'
    };
    return map[ext] || 'application/octet-stream';
  }

  // ─────────────────────────────────────────────
  //  ORDER STORE  (Client → Vendor)
  // ─────────────────────────────────────────────
  function submitOrder(fhirResource, attachmentMetas) {
    const orders = readJSON(KEYS.ORDERS);
    const id = fhirResource.id || genId('SR');
    fhirResource.id = id;
    fhirResource.meta = { ...fhirResource.meta, lastUpdated: now(), source: 'fhir-client-platform' };

    const envelope = {
      id,
      fhir: fhirResource,
      attachments: attachmentMetas || [],
      status: 'new',         // new → accepted → in-progress → completed
      sentAt: now(),
      receivedAt: null,
      acceptedAt: null,
    };

    orders.unshift(envelope);
    writeJSON(KEYS.ORDERS, orders);

    addAudit({ type: 'ORDER_SENT', orderId: id, resource: fhirResource.resourceType,
               patient: fhirResource.subject?.display || fhirResource.subject?.reference,
               priority: fhirResource.priority });

    // Broadcast to vendor tab
    orderChannel.postMessage({ event: 'NEW_ORDER', envelope });
    // Also fire storage event for cross-tab compat
    localStorage.setItem('fhir_last_order_ping', JSON.stringify({ id, ts: now() }));

    return envelope;
  }

  function getOrders(filter) {
    const orders = readJSON(KEYS.ORDERS);
    if (!filter) return orders;
    return orders.filter(o => {
      if (filter.status && o.status !== filter.status) return false;
      if (filter.since) return new Date(o.sentAt) >= new Date(filter.since);
      return true;
    });
  }

  function updateOrderStatus(id, status) {
    const orders = readJSON(KEYS.ORDERS);
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return false;
    orders[idx].status = status;
    if (status === 'accepted') orders[idx].acceptedAt = now();
    writeJSON(KEYS.ORDERS, orders);
    orderChannel.postMessage({ event: 'ORDER_STATUS_CHANGED', orderId: id, status });
    addAudit({ type: 'ORDER_STATUS', orderId: id, status });
    return true;
  }

  // ─────────────────────────────────────────────
  //  RESULT STORE  (Vendor → Client)
  // ─────────────────────────────────────────────
  function sendResult(fhirBundle, attachmentMetas) {
    const results = readJSON(KEYS.RESULTS);
    const id = genId('DR');
    const basedOnRef = fhirBundle?.entry?.[0]?.resource?.basedOn?.[0]?.reference || '';
    const orderId = basedOnRef.replace('ServiceRequest/', '');

    fhirBundle.id = id;
    fhirBundle.meta = { lastUpdated: now(), source: 'fhir-vendor-platform' };

    const envelope = {
      id,
      orderId,
      fhir: fhirBundle,
      attachments: attachmentMetas || [],
      status: 'final',
      sentAt: now(),
      acknowledged: false,
    };

    results.unshift(envelope);
    writeJSON(KEYS.RESULTS, results);

    // Mark the originating order as completed
    if (orderId) updateOrderStatus(orderId, 'completed');

    addAudit({ type: 'RESULT_SENT', resultId: id, orderId,
               resourceType: 'DiagnosticReport + Bundle' });

    // Broadcast to client tab
    resultChannel.postMessage({ event: 'NEW_RESULT', envelope });
    localStorage.setItem('fhir_last_result_ping', JSON.stringify({ id, ts: now() }));

    return envelope;
  }

  function getResults(filter) {
    const results = readJSON(KEYS.RESULTS);
    if (!filter) return results;
    return results.filter(r => {
      if (filter.orderId && r.orderId !== filter.orderId) return false;
      if (filter.acknowledged !== undefined && r.acknowledged !== filter.acknowledged) return false;
      return true;
    });
  }

  function acknowledgeResult(id) {
    const results = readJSON(KEYS.RESULTS);
    const idx = results.findIndex(r => r.id === id);
    if (idx === -1) return false;
    results[idx].acknowledged = true;
    results[idx].acknowledgedAt = now();
    writeJSON(KEYS.RESULTS, results);
    addAudit({ type: 'RESULT_ACKNOWLEDGED', resultId: id });
    return true;
  }

  function getUnacknowledgedCount() {
    return readJSON(KEYS.RESULTS).filter(r => !r.acknowledged).length;
  }

  // ─────────────────────────────────────────────
  //  AUDIT LOG
  // ─────────────────────────────────────────────
  function getAuditLog(limit) {
    const log = readJSON(KEYS.AUDIT);
    return limit ? log.slice(0, limit) : log;
  }

  // ─────────────────────────────────────────────
  //  CLEAR / RESET (dev/testing)
  // ─────────────────────────────────────────────
  function clearAll() {
    [KEYS.ORDERS, KEYS.RESULTS, KEYS.FILES_META, KEYS.AUDIT].forEach(k => localStorage.removeItem(k));
    // Clear file data
    Object.keys(localStorage).filter(k => k.startsWith(KEYS.FILE_DATA)).forEach(k => localStorage.removeItem(k));
    console.log('[FHIR Bridge] All data cleared.');
  }

  function getStorageUsage() {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += (localStorage[key].length + key.length) * 2;
      }
    }
    return {
      bytes: total,
      kb: (total / 1024).toFixed(1),
      mb: (total / 1048576).toFixed(2),
      percentOfTypical5MB: ((total / (5 * 1048576)) * 100).toFixed(1)
    };
  }

  // ─────────────────────────────────────────────
  //  SUBSCRIPTION HELPERS  (attach listeners)
  // ─────────────────────────────────────────────
  function onNewOrder(callback) {
    orderChannel.onmessage = e => {
      if (e.data?.event === 'NEW_ORDER') callback(e.data.envelope);
    };
    // Also listen for cross-origin storage events
    window.addEventListener('storage', e => {
      if (e.key === 'fhir_last_order_ping') {
        const orders = readJSON(KEYS.ORDERS);
        if (orders.length > 0) callback(orders[0]);
      }
    });
  }

  function onOrderStatusChange(callback) {
    orderChannel.onmessage = e => {
      if (e.data?.event === 'ORDER_STATUS_CHANGED') callback(e.data.orderId, e.data.status);
    };
  }

  function onNewResult(callback) {
    resultChannel.onmessage = e => {
      if (e.data?.event === 'NEW_RESULT') callback(e.data.envelope);
    };
    window.addEventListener('storage', e => {
      if (e.key === 'fhir_last_result_ping') {
        const results = readJSON(KEYS.RESULTS);
        if (results.length > 0) callback(results[0]);
      }
    });
  }

  // ─────────────────────────────────────────────
  //  FHIR RESOURCE BUILDERS
  // ─────────────────────────────────────────────
  function buildServiceRequest(formData) {
    return {
      resourceType: 'ServiceRequest',
      id: genId('SR'),
      status: 'active',
      intent: 'order',
      priority: formData.priority || 'routine',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.categoryCode || '108252007',
          display: formData.categoryDisplay || 'Laboratory procedure'
        }]
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: formData.loincCode || '',
          display: formData.testName || ''
        }],
        text: formData.testName || ''
      },
      subject: {
        reference: 'Patient/' + (formData.patientId || 'unknown'),
        display: (formData.patientFirst || '') + ' ' + (formData.patientLast || '')
      },
      requester: {
        reference: 'Practitioner/' + (formData.pracId || 'PRAC-001'),
        display: 'Dr. ' + (formData.pracFirst || '') + ' ' + (formData.pracLast || '')
      },
      reasonCode: formData.reason ? [{ text: formData.reason }] : undefined,
      authoredOn: now(),
      note: formData.notes ? [{ text: formData.notes }] : undefined,
      performer: [{
        reference: 'Organization/METRO-LAB',
        display: 'Metro Lab Services'
      }]
    };
  }

  function buildDiagnosticBundle(reportData, observations) {
    const drId = genId('DR');
    const entries = [
      {
        resource: {
          resourceType: 'DiagnosticReport',
          id: drId,
          status: reportData.status || 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: reportData.categoryCode || 'LAB',
              display: reportData.categoryDisplay || 'Laboratory'
            }]
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: reportData.loincCode || '',
              display: reportData.reportName || ''
            }],
            text: reportData.reportName || ''
          },
          subject: {
            reference: 'Patient/' + (reportData.patientMrn || 'unknown'),
            display: reportData.patientName || ''
          },
          issued: now(),
          effectiveDateTime: reportData.collected || now(),
          performer: [{ display: reportData.facility || 'Metro Lab Services' }],
          conclusion: reportData.conclusion || '',
          basedOn: reportData.orderRef ? [{ reference: 'ServiceRequest/' + reportData.orderRef }] : [],
          result: observations.map((_, i) => ({ reference: 'Observation/obs-' + drId + '-' + i }))
        },
        request: { method: 'POST', url: 'DiagnosticReport' }
      },
      ...observations.map((obs, i) => ({
        resource: {
          resourceType: 'Observation',
          id: 'obs-' + drId + '-' + i,
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory'
            }]
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: obs.loincCode || '',
              display: obs.name || ''
            }],
            text: obs.name || ''
          },
          subject: { reference: 'Patient/' + (reportData.patientMrn || 'unknown') },
          valueQuantity: {
            value: parseFloat(obs.value) || 0,
            unit: obs.unit || '',
            system: 'http://unitsofmeasure.org',
            code: obs.unit || ''
          },
          referenceRange: obs.refRange ? [{ text: obs.refRange }] : undefined,
          interpretation: obs.flag ? [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: obs.flag,
              display: { H:'High', L:'Low', HH:'Critical High', LL:'Critical Low', A:'Abnormal', N:'Normal' }[obs.flag] || obs.flag
            }]
          }] : undefined
        },
        request: { method: 'POST', url: 'Observation' }
      }))
    ];

    return {
      resourceType: 'Bundle',
      id: genId('BDL'),
      type: 'transaction',
      timestamp: now(),
      entry: entries
    };
  }

  // ─────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────
  window.FHIRBridge = {
    // Orders
    submitOrder,
    getOrders,
    updateOrderStatus,
    // Results
    sendResult,
    getResults,
    acknowledgeResult,
    getUnacknowledgedCount,
    // Files
    storeFile,
    getFileData,
    downloadFile,
    deleteFile,
    getFileMeta: () => readJSON(KEYS.FILES_META),
    // Subscriptions
    onNewOrder,
    onNewResult,
    onOrderStatusChange,
    // Builders
    buildServiceRequest,
    buildDiagnosticBundle,
    // Utils
    getAuditLog,
    getStorageUsage,
    clearAll,
    genId,
    now,
    KEYS
  };

})(window);
