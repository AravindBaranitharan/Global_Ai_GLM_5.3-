import { langOf, nativeName } from './lang'

it('tags each Indian script and leaves Latin text as English', () => {
  expect(langOf('पासवर्ड को कैसे संग्रहीत करना चाहिए?')).toBe('hi')
  expect(langOf('పాస్‌వర్డ్‌లను ఎలా నిల్వ చేయాలి?')).toBe('te')
  expect(langOf('ಪಾಸ್‌ವರ್ಡ್‌ಗಳನ್ನು ಹೇಗೆ ಸಂಗ್ರಹಿಸಬೇಕು?')).toBe('kn')
  expect(langOf('പാസ്‌വേഡുകൾ എങ്ങനെ സംഭരിക്കണം?')).toBe('ml')
  expect(langOf('পাসওয়ার্ড কীভাবে সংরক্ষণ করা উচিত?')).toBe('bn')
  expect(langOf('கடவுச்சொற்களை எப்படி சேமிக்க வேண்டும்?')).toBe('ta')
  expect(langOf('Comment stocker les mots de passe ?')).toBe('en')
  expect(nativeName('bn')).toBe('বাংলা')
})
