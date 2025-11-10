// Placeholder Storacha IPFS client via UCAN delegation
// Expects env: STORACHA_SPACE_DID, STORACHA_DELEGATION_CAR_PATH

export async function uploadJson(json: any) {
  console.log('[storacha] uploadJson called', { size: JSON.stringify(json).length })
  // Placeholder: In production, initialize Storacha client with DID and CAR proof
  // and upload to IPFS, returning a content-addressed URI
  const cid = 'bafyplaceholderjson' // mock
  return { cid, uri: `ipfs://${cid}` }
}

export async function uploadFileBase64(dataUrl: string) {
  console.log('[storacha] uploadFileBase64 called', { size: dataUrl?.length })
  const cid = 'bafyplaceholderfile'
  return { cid, uri: `ipfs://${cid}` }
}
