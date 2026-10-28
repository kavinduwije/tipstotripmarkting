"""Translate recorded UI labels in place; retain original controls, values and action timing."""
from pathlib import Path
import json,re,unicodedata,collections,subprocess
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
D=ROOT/'artifacts/travel-buddy-es/localisation'
PAIRS='''Trip Details|Detalles del viaje
Create Travel Buddy Post|Crea publicación de viaje
Request to Join|Solicitar unirse
Request to Joh|Solicitar unirse
Sri lankan travel guide|Guía de Sri Lanka
Looking for a buddy to Trip to Sri Lanka|Busco compañía para viajar a Sri Lanka
Looking for a buddy to Trip to Spain|Busco compañía para viajar a España
Trip to Spain|Viaje a España
Trip to Sri Lanka|Viaje a Sri Lanka
Messages|Mensajes
Requested to join|Ha solicitado unirse
English (US)|Español (ES)
Trip photos|Fotos del viaje
Accept|Aceptar
Reject|Rechazar
Spain|España
France|Francia
Preferences|Preferencias
Current Location v|Ubicación actual
Manage Trips|Gestionar viajes
Search trips, destinations or hosts|Busca viajes, destinos o anfitriones
Near You|Near You
Sharing text|Compartir
Quick|Compartir
Share|rápido
To|Destino
From|Origen
Other|Otros
Budget range|Presupuesto
Low budget|Económico
Mid-range|Medio
Luxury|Lujo
Currency|Moneda
Travel style|Estilo de viaje
Manage Requests|Gestionar solicitudes
Tell us where you are heading so we can find the|Cuéntanos adónde vas para encontrar
best buddy matches.|a tus compañeros ideales.
Trip name|Nombre del viaje
Next|Siguiente
Day 1|Día 1
Day 2|Día 2
Day 3|Día 3
Photos|Fotos
Done|Listo
Custom trip budget (optional)|Presupuesto personalizado (opcional)
My Trips|Mis viajes
Requested|Solicitados
Accepted|Aceptados
Hosting •|Organizo
Completed|Finalizados
Pending (Cancel)|Pendiente (Cancelar)
Easy-going / flexible|Tranquilo / flexible
Type a message...|Escribe un mensaje...
Trip date|Fechas del viaje
Adventure|Aventura
Sightseeing|Turismo
Trip|Viaje
Enter trip your details|Introduce los detalles
Save and continue|Guardar y continuar
Age group|Edad
Gender|Género
Male|Hombre
Female|Mujer
Non-binary|No binario
Prefer not to say|Prefiero no decirlo
Beach & Relax|Playa y relax
Food & Culture|Gastronomía y cultura
Flexible|Flexible
Planned & organized|Planificado
Party lover|Fiestero
Quiet & relaxed|Tranquilo
Photography lover|Amante de la fotografía
Food hunter|Amante de la gastronomía
Ideal travel buddy|Compañero ideal
Join to Chat|Entrar al chat
Accept a traveler to start the trip group chat.|Acepta a alguien para abrir el chat del grupo.
Pending requests|Solicitudes pendientes
you|tú
simple and edit later.|y editarlo después.
Stop 1|Parada 1
Name of visiting place|Nombre del lugar
Time to visit|Hora de la visita
What will you do here?|¿Qué harás aquí?
Photos 0/6|Fotos 0/6
Add|Añadir
Loading Google Maps photos...|Cargando fotos de Google Maps...
Add location|Añadir lugar
Collections|Colecciones
Set who you would like to travel with|Elige con quién te gustaría viajar
and review the details. Tap Post buddy|y revisa los detalles. Pulsa Publicar
request to publish. Your post is only live|para publicar. Tu viaje solo será visible
after the success confirmation.|tras recibir la confirmación.
Criteria matching|Preferencias de compañía
Help us match you with the right people. Share|Encuentra personas afines. Comparte
what matters to you.|lo que te importa.
Travel purpose|Motivo del viaje
Nightlife|Vida nocturna
Workcation|Trabajar y viajar
Itinerary|Itinerario
Purpose: Nightlife, Workcation|Motivo: ocio nocturno, trabajar y viajar
Budget: Flexible|Presupuesto: flexible
Create travel buddy post|Crear publicación de viaje
Preview|Vista previa
Criteria|Preferencias
Full calendar days|Días completos
Trip budget|Presupuesto
Creator estimate|Estimación del creador
Calendar duration|Duración del calendario
Preference match|Afinidad de preferencias
26 of 26|26 de 26
preferences|preferencias
Match compares your saved travel preferences with|Compara tus preferencias guardadas con
this trip's description, locations, itinerary, and Juila|la descripción, los lugares, la ruta y las
Rodriguz's travel preferences.|preferencias de viaje de Juila Rodriguz.
Style: Easy-going / flexible, Party lover|Estilo: tranquilo / flexible, fiestero
Post buddy request|Publicar viaje
Trip overview|Resumen del viaje
Trip length|Duración del viaje
Total time|Tiempo total
288 hours|288 horas
Ideal buddy: Any gender, Experienced traveler|Compañía: cualquier género, con experiencia
Smoking: Only socially|Tabaco: solo socialmente
Drinking: Occasionally|Alcohol: ocasionalmente
Routine: Night owl|Rutina: nocturna
Expectations: Make new friends, Long-term frie|Expectativas: hacer amigos, amistad duradera
Select a start and end date to continue.|Elige la fecha de inicio y de fin.
Same gender|Mismo género
Any gender|Cualquier género
Similar age group|Edad similar
Anyone friendly|Alguien amable
Experienced traveler|Con experiencia
First-time traveler|Primer viaje
Origin city or country|Ciudad o país de origen
Prigin city or country|Ciudad o país de origen
Destination city or country|Ciudad o país de destino
September|Septiembre
space|espacio
return|intro
Hiii|Holaaa
Hili|Holaaa
Hii|Holaaa
Hi|Hola
Can you book|¿Puedes reservar
tickets|entradas
tickets?|entradas?
September|Septiembre
Ex: Alps winter escape|Ej.: escapada a los Alpes
Add Google Maps|¿Añadir fotos de
photos?|Google Maps?
Pull up to 4 photos from Google Maps|Añade hasta 4 fotos de Google Maps
for this place. You can still add or|de este lugar. Después podrás añadir
remove your own photos afterward.|o eliminar tus propias fotos.
Yes, add photos|Sí, añadir fotos
Plan your days.|Planifica tus días.
Plan your days|Planifica tus días
Add the places you want to visit. You can keep it|Añade los lugares que quieres visitar.
Build your itinerary with the places and|Prepara tu ruta con los lugares y
activities you have in mind. Complete|actividades que tienes en mente.
the required details, then continue to|Completa los detalles y pasa a las
photos.|fotos.
Name of visiting places|Nombre de los lugares
Joined travelers|Viajeros que se han unido
Swipe left on a traveler to remove from trip.|Desliza a la izquierda para eliminar a alguien.
Updating...|Actualizando...
Message|Mensaje
2 Messages|2 mensajes
Hosting|Organizo
Requests|Solicitudes
Current Location Y|Ubicación actual
November 2026-|Noviembre 2026-
October 2026|Octubre 2026
December 2026|Diciembre 2026
Pestination city or country|Ciudad o país de destino
Enter trip your detalls|Introduce los detalles
Add photos thi|Añade fotos a
your trip to life|tu viaje
ements below!|¡Comparte tu plan!
ticket|entrada
tickets|entradas
Travel|Viaje
Trips|Viajes
Similar ane aroun|Edad similar
Anvone friendlv|Alguien amable
Evnariancer traveler|Con experiencia
Rudnet range|Presupuesto
custom tup buager (opuronal)|Presupuesto personalizado (opcional)
Adiantoin|Aventura
Adiantina|Aventura
Adiantino|Aventura
Armonturo|Aventura
Ciahtannina|Turismo
Cinhtannina|Turismo
Cishtannina|Turismo
Cinhtcasinm|Turismo
Reach & Relay|Playa y relax
Fond & Culture|Gastronomía y cultura
and|y
for|para
your|tu
book|reservar
today|hoy
tomorrow|mañana
that|eso
Free|Gratis
Test|Prueba'''
def norm(s):return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',s)).strip()
table={norm(p.split('|')[0]).lower():p.split('|')[1] for p in PAIRS.splitlines()}
def translate(raw):
 s=norm(raw);low=s.lower()
 if low in table:return table[low]
 # Keep selected-state marks and arrows at their recorded coordinates.
 match=re.match(r'^([+*•›><✓/×xXVv~\\]+)\s+(.+)$',s)
 if match and match[2].lower() in table:
  prefix=match[1];prefix='✓' if prefix in ['v','V','/','~','\\'] else prefix
  return prefix+' '+table[match[2].lower()]
 if low.startswith('looking for a buddy to trip to sri lanka'):return 'Busco compañía para viajar a Sri Lanka'
 if low.startswith('looking for a buddy to trip to spain'):return 'Busco compañía para viajar a España'
 if low.startswith('trip to sri lanka'):return 'Viaje a Sri Lanka'
 if low.startswith('trip to spain'):return 'Viaje a España'
 if low.startswith('trip to '):return 'Viaje a '+('Españ' if low.startswith('trip to spa') else s[8:])
 if s in ['Trip t','Trip to']:return 'Viaje a'
 if low.startswith('check out "trip to spain'):return 'Descubre «Viaje a España» en Tips'
 if s=='To Trip: https://tipstotrip.com/p/trip...':return s
 if re.match(r'^Trip deta',s) or re.match(r'^< Trip deta',s):return 'Detalles'
 if re.match(r'^\d+ days$',s):return s.replace('days','días')
 if re.match(r'^Step \d of 4$',s):return s.replace('Step','Paso').replace('of','de')
 if s.startswith('Post buddy request'):return 'Publicar viaje →'
 if s.startswith('Save and continue'):return 'Guardar y continuar →'
 if s.startswith('+ Create travel buddy post'):return '+ Crear publicación de viaje'
 if 'joined the trip.' in s:return s.replace('joined the trip.','se ha unido al viaje.')
 if 'was removed from the trip.' in s:return s.replace('was removed from the trip.','ya no está en el viaje.')
 if s.startswith('@Maria Bruse Can'):return '@Maria Bruse ¿Puedes reservar' if len(s)>19 else '@Maria Bruse ¿Puedes'
 if s.startswith('Meet Buddy Laura is live'):return 'Meet Buddy: Laura está en línea'
 if 'Meet Buddy' in s and 'Travel Buddy' in s:return None
 if 'Build your itinerary with the places and' in s:return 'Prepara tu ruta con los lugares y'
 if 'Set who you would like to travel with' in s:return 'Elige con quién te gustaría viajar'
 if s.startswith('Request to J'):return 'Solicitar unirse'
 if s.startswith('tickets'):return 'entradas'+('?' if '?' in s else '')
 if s.startswith('Dates:'):return s.replace('Dates:','Fechas:').replace('Dec','dic')
 # Spanish date and country names; proper place/person names are retained.
 for a,b in [('France','Francia'),('Spain','España'),('Russia','Rusia'),('Japan','Japón'),('Canada','Canadá')]:s=re.sub(r'\b'+a+r'\b',b,s)
 for a,b in [('Sun','dom'),('Mon','lun'),('Tue','mar'),('Wed','mié'),('Thu','jue'),('Fri','vie'),('Sat','sáb'),('December','Diciembre'),('October','Octubre'),('Dec','dic'),('Oct','oct'),('Sep','sep')]:s=re.sub(r'\b'+a+r'\b',b,s)
 return s if s!=norm(raw) else None

ocr=json.loads((D/'full-ocr.json').read_text())
byfile={r['file']:r for r in ocr}
mapping=json.loads((D/'frame-map.json').read_text())
fontfile='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
fonts={}
def font(size):
 size=max(6,int(size))
 if size not in fonts:fonts[size]=ImageFont.truetype(fontfile,size)
 return fonts[size]
usage=collections.Counter();untranslated=collections.Counter()
def render(image,lines):
 patches=[];m=np.zeros(image.shape[:2],np.uint8)
 for line in lines:
  source=line['text'];target=translate(source)
  if not target or target==source:
   if len(source)>3 and re.search('[a-zA-Z]',source):untranslated[source]+=1
   continue
  x,y,w,h=line['box'];x0=max(0,int(x)-1);y0=max(0,int(y)-1);x1=min(image.shape[1],int(np.ceil(x+w))+1);y1=min(image.shape[0],int(np.ceil(y+h))+2)
  if x1<=x0 or y1<=y0:continue
  region=image[y0:y1,x0:x1];lum=cv2.cvtColor(region,cv2.COLOR_BGR2GRAY)
  # Estimate the native ink colour. Light ink appears on the green action buttons.
  edge=np.concatenate([region[0],region[-1],region[:,0],region[:,-1]])
  bg=np.median(edge,axis=0);bglum=float(np.mean(bg))
  if bglum<165:
   pixels=region[lum>=np.percentile(lum,93)];colour=np.percentile(pixels,70,axis=0) if len(pixels) else np.array([255]*3)
  else:
   pixels=region[lum<=np.percentile(lum,18)];colour=np.percentile(pixels,35,axis=0) if len(pixels) else np.array([30]*3)
  # Erase only the glyphs, leaving native button outlines, ticks and photos intact.
  diff=np.linalg.norm(region.astype(float)-bg,axis=2)
  glyph=(diff>38).astype(np.uint8)*255
  glyph=cv2.dilate(glyph,np.ones((2,2),np.uint8))
  m[y0:y1,x0:x1]=np.maximum(m[y0:y1,x0:x1],glyph)
  patches.append((source,target,(x,y,w,h),tuple(int(c) for c in colour[::-1])))
 out=cv2.inpaint(image,m,2,cv2.INPAINT_TELEA)
 canvas=Image.fromarray(cv2.cvtColor(out,cv2.COLOR_BGR2RGB));draw=ImageDraw.Draw(canvas)
 for source,target,(x,y,w,h),colour in patches:
  spain_flag=source.lower().startswith('trip to spain')
  available=w-17 if spain_flag else w
  if source=='To':available=75
  size=max(7,round(h*1.27));f=font(size)
  # Match the original line width and baseline; never move the interaction target.
  while draw.textlength(target,font=f)>available+1 and size>6:size-=1;f=font(size)
  actual=draw.textlength(target,font=f);tx=x if source=='To' else x+(available-actual)/2
  bbox=draw.textbbox((0,0),target,font=f);ty=y+(h-(bbox[3]-bbox[1]))/2-bbox[1]
  draw.text((tx,ty),target,font=f,fill=colour)
  if spain_flag:
   fx=x+w-14;fy=y+max(0,(h-9)/2)
   draw.rectangle((fx,fy,fx+13,fy+9),fill='#AA151B');draw.rectangle((fx,fy+2.2,fx+13,fy+6.8),fill='#F1BF00');draw.rectangle((fx+3,fy+3.2,fx+4.5,fy+6),fill='#AA151B')
  usage[(source,target)]+=1
 return cv2.cvtColor(np.array(canvas),cv2.COLOR_RGB2BGR)

if __name__=='__main__':
 import sys
 preview='--preview' in sys.argv
 target=D/('preview' if preview else 'translated-frames');target.mkdir(exist_ok=True)
 items=list(mapping.items())
 if preview:items=[(name,anchor) for name,anchor in items if int(name.split('-')[1].split('.')[0])%30==0]
 for i,(name,anchor) in enumerate(items):
  image=cv2.imread(str(D/'frames'/name));lines=byfile[anchor]['lines']
  cv2.imwrite(str(target/name),render(image,lines))
  if i%150==0:print('translated',i,len(items),flush=True)
 (D/('preview-translation-audit.json' if preview else 'translation-audit.json')).write_text(json.dumps({'method':'Local Apple Vision OCR; translated glyphs inpainted within their recorded bounds; original controls, photos, keyboard positions, action timing and touches retained. Adjacent app frames with average grey pixel change <= 0.14 reuse the exact OCR region positions.','translated':[{'source':a,'spanish':b,'frames':n}for(a,b),n in usage.most_common()],'retainedText':untranslated.most_common()},ensure_ascii=False,indent=2))
