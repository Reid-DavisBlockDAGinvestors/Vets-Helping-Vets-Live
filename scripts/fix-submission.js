/**
 * Fix submission by adding missing contract_address
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  const submissionId = '8ebd6b09-11ff-4728-a6f8-cb18a2cdea95'
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
  
  console.log('=== Fix Submission ===')
  console.log('Submission ID:', submissionId)
  console.log('Contract Address:', contractAddress)
  
  // Update the submission
  const { data, error } = await supabase
    .from('submissions')
    .update({ contract_address: contractAddress })
    .eq('id', submissionId)
    .select()
  
  if (error) {
    console.error('Error:', error.message)
    return
  }
  
  console.log('\n✅ Updated successfully!')
  console.log('New contract_address:', data?.[0]?.contract_address)
}

main()
