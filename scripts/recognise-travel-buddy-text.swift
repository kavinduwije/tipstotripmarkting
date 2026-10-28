import Foundation
import Vision
import AppKit

let source=URL(fileURLWithPath:CommandLine.arguments[1])
let output=URL(fileURLWithPath:CommandLine.arguments[2])
let files=try FileManager.default.contentsOfDirectory(at:source,includingPropertiesForKeys:nil).filter{$0.pathExtension=="png"}.sorted{$0.lastPathComponent < $1.lastPathComponent}
var results:[[String:Any]]=[]
let lock=NSLock()
let queue=OperationQueue()
queue.maxConcurrentOperationCount=4
var failure:Error?=nil
for (index,url) in files.enumerated(){queue.addOperation{
 do {try autoreleasepool {
  let image=NSImage(contentsOf:url)!
  var rect=CGRect(origin:.zero,size:image.size)
  let cg=image.cgImage(forProposedRect:&rect,context:nil,hints:nil)!
  let request=VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages=["en-US"]
  request.usesLanguageCorrection=true
  request.minimumTextHeight=0.006
  try VNImageRequestHandler(cgImage:cg,options:[:]).perform([request])
  let lines=(request.results ?? []).compactMap { observation -> [String:Any]? in
   guard let c=observation.topCandidates(1).first else{return nil}
   let box=observation.boundingBox
   return ["text":c.string,"confidence":c.confidence,"box":[box.minX*Double(cg.width),(1-box.maxY)*Double(cg.height),box.width*Double(cg.width),box.height*Double(cg.height)]]
  }
  lock.lock();results.append(["file":url.lastPathComponent,"lines":lines]);lock.unlock()
 }}catch{lock.lock();failure=error;lock.unlock()}
 if index % 100 == 0 {fputs("OCR \(index)/\(files.count)\n",stderr)}
}}
queue.waitUntilAllOperationsAreFinished()
if let failure=failure{throw failure}
results.sort{($0["file"] as! String)<($1["file"] as! String)}
try JSONSerialization.data(withJSONObject:results,options:[.sortedKeys]).write(to:output)
