/** Installable spreadsheet trigger: on form submit. NOT installed by this file. */
const FORM_ID = '19JReWvo-11bzk6X1iIARghDLEh0pLDaJHr2Bu8RmMFc';
const SPREADSHEET_ID = '1NfrBGvwW-E9ncHnvhlMDgl_qbTiMraJD8N2Un9mIwe0';
const SHEET_NAME = 'Respostas do Formulário 1';
// Verified against row 1 of the Girafinha response sheet on 26/09/2026.
// 1-based columns. Duplicate titles are distinguished by position.
const HEADERS = {
  email:[2,'Endereço de email'], customerName:[3,'Dados da pessoa responsável pelo evento'],
  phone:[4,'Dados da pessoa responsável pelo evento'],
  oldEmail:[5,'Dados da pessoa responsável pelo evento'],
  nif:[6,'Dados da pessoa responsável pelo evento'],
  birthdayChildName:[7,'Dados do evento'],birthdayChildAge:[8,'Idade que comemora:'],
  eventDate:[9,'Data do evento:'],oldTime:[10,'Qual o horário pretendido?'],
  pack:[11,'Pack escolhido'],partyTheme:[13,'Se respondeu sim, indique-nos qual o tema da decoração.'],
  decorationNotes:[14,'Tem algum pedido especial para a decoração?'],
  cateringNotes:[15,'O pack escolhido inclui lanche/catering?'],
  requestedExtras:[16,'Pretende adicionar algum extra? Se sim diga-nos quais.'],
  allergies:[17,'Alergias/Restrições/Intolerâncias alimentares'],
  imageAuthorization:[18,'Autoriza a divulgação de fotos da festa?'],
  deposit:[19,'Valor do sinal pago'],paymentMethod:[20,'Forma de pagamento do sinal'],
  termsAccepted:[21,'Confirmo que li e aceito as condições do Espaço Girafinha*'],
  source:[22,'Como conheceu o Espaço Girafinha?'],
  notes:[23,'Observações finais (deixe-nos alguma informação ou pedido que ache importante).'],
  time:[24,'Qual o horário pretendido?'],
  requestedService:[25,'Pretende adicionar algum serviço extra para a sua festa?']
};
function onGirafinhaFormSubmit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== SHEET_NAME) throw new Error('Unexpected trigger or sheet');
  const sheet = e.range.getSheet();
  if (sheet.getParent().getId() !== SPREADSHEET_ID) throw new Error('Unexpected spreadsheet');
  const row = e.range.getRow();
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  const cells = sheet.getRange(row,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  const submitted = sheet.getRange(row,1).getValue();
  if (!(submitted instanceof Date) || isNaN(submitted.getTime())) throw new Error('Missing submission timestamp');
  const fields = {};
  Object.keys(HEADERS).forEach(key=>{
    const [column,title]=HEADERS[key];
    if (String(headers[column-1]||'').trim()!==title) throw new Error('Header changed at column '+column);
    fields[key]=String(cells[column-1]||'');
  });
  fields.time=fields.time||fields.oldTime; // X new; J historical fallback.
  // The row number can change after sorting; use the submission timestamp and
  // captured answers instead. Editing an answer later requires manual review.
  const identity=JSON.stringify({submittedAt:submitted.toISOString(),fields});
  const identityHash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,identity,Utilities.Charset.UTF_8)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  const payload=JSON.stringify({formId:FORM_ID,submissionId:`${SPREADSHEET_ID}:${sheet.getSheetId()}:${identityHash}`,submittedAt:submitted.toISOString(),fields});
  const props=PropertiesService.getScriptProperties();
  const secret=props.getProperty('GOOGLE_FORMS_INTEGRATION_SECRET');
  const endpoint=props.getProperty('GIRAFINHA_INTEGRATION_URL');
  if (!secret || !endpoint) throw new Error('Missing integration configuration');
  const digest=Utilities.computeHmacSha256Signature(payload,secret,Utilities.Charset.UTF_8);
  const signature=digest.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  const response=UrlFetchApp.fetch(endpoint, {method:'post',contentType:'application/json',payload,
    headers:{'x-girafinha-signature':signature},muteHttpExceptions:true});
  const status=response.getResponseCode();
  // Never log payload, signature, contact details or response body.
  if (status<200 || status>=300) throw new Error('Girafinha import HTTP '+status);
  console.log('Girafinha import HTTP '+status+' row '+row);
}
