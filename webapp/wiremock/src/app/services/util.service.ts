import {ElementRef, Injectable, QueryList} from '@angular/core';
import * as vkbeautify from 'vkbeautify';
import {Item} from '../model/wiremock/item';
import {Message, MessageService, MessageType} from '../components/message/message.service';
import {StubMapping} from '../model/wiremock/stub-mapping';
import {v4 as uuidv4} from 'uuid';

@Injectable()
export class UtilService {

  public static WIREMOCK_GUI_KEY = 'wiremock-gui';
  public static DIR_KEY = 'folder';

  public static copyToClipboard(text: string): boolean {
    // https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript

    const textArea = document.createElement('textarea');

    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';

    // Ensure it has a small width and height. Setting to 1px / 1em
    // doesn't work as this gives a negative w/h on some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = '0';

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';


    textArea.value = text;

    document.body.appendChild(textArea);

    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        return true;
      } else {
        console.error('Was not able to copy. No exception was thrown. Result=' + successful);
      }
    } catch (err) {
      console.error(err);
    } finally {
      document.body.removeChild(textArea);
    }

    return false;
  }

  public static showErrorMessage(messageService: MessageService, err: any): void {
    if (UtilService.isDefined(err)) {
      let message = err.statusText + '\nstatus=' + err.status + '\nmessage:\n' + err.message;
      if (UtilService.isDefined(err.error) && err.error instanceof ProgressEvent) {
        if (err.status === 0) {
          message = 'Wiremock not started?\n------------------------------\n' + message;
        }
        messageService.setMessage(new Message(message, MessageType.ERROR, 10000));
      } else {
        messageService.setMessage(new Message(err.statusText + ': status=' + err.status + ', message=',
          MessageType.ERROR, 10000, err.message));
      }
    } else {
      messageService.setMessage(new Message('Ups! Unknown error :(', MessageType.ERROR, 10000));
    }
  }

  public static getSoapRecognizeRegex(): RegExp {
    return /<([^/][^<> ]*?):Envelope[^<>]*?>\s*?<([^/][^<> ]*?):Body[^<>]*?>/;
  }

  public static getSoapNamespaceRegex(): RegExp {
    return /xmlns:([^<> ]+?)="([^<> ]+?)"/g;
  }

  public static getSoapMethodRegex(): RegExp {
    return /<[^/][^<> ]*?:Body[^<>]*?>\s*?<([^/][^<> ]*?):([^<> ]+)[^<>]*?>/;
  }

  public static getSoapXPathRegex(): RegExp {
    return /\/.*?Envelope\/.*?Body\/([^: ]+:)?(.+)/;
  }

  public static isDefined(value: any): boolean {
    return !(value === null || typeof value === 'undefined');
  }

  public static isGuiDefined(value: StubMapping): boolean {
    return UtilService.isDefined(value.metadata) && UtilService.isDefined(value.metadata[UtilService.WIREMOCK_GUI_KEY]);
  }

  public static isFolderDefined(value: StubMapping): boolean {
    return UtilService.isGuiDefined(value) && UtilService.isDefined(value.metadata[UtilService.WIREMOCK_GUI_KEY][UtilService.DIR_KEY]);
  }

  public static isUndefined(value: any): boolean {
    return !UtilService.isDefined(value);
  }

  public static isBlank(value: string): boolean {
    return (UtilService.isUndefined(value) || value.length === 0);
  }

  public static isNotBlank(value: string): boolean {
    return !this.isBlank(value);
  }

  public static itemModelStringify(item: any): string {
    if (item._code === null || typeof item._code === 'undefined') {
      Object.defineProperty(item, '_code', {
        enumerable: false,
        writable: true
      });
      item._code = JSON.stringify(item);
    }
    return item._code;
  }

  public static getParametersOfUrl(url: string) {
    if (UtilService.isUndefined(url)) {
      return '';
    }

    const uri_dec = decodeURIComponent(url);

    const paramStart = uri_dec.indexOf('?');

    if (paramStart < 0) {
      return '';
    }

    return UtilService.extractQueryParams(uri_dec.substring(paramStart + 1));
  }

  private static extractQueryParams(queryParams) {
    if (UtilService.isUndefined(queryParams)) {
      return [];
    }

    const decodeQueryParams = decodeURIComponent(queryParams);

    const result = [];

    // This works but typescript is not aware of entries function yet
    // if(isDefined(URLSearchParams)){
    //   const params = new URLSearchParams(decodeQueryParams);
    //
    //   for(const pair of params.entries()){
    //     result.push({key: pair[0], value: pair[1]})
    //   }
    //
    //   return result;
    // }

    const array = decodeQueryParams.split('&');
    let splitKeyValue;
    for (let i = 0; i < array.length; i++) {
      splitKeyValue = array[i].split('=');
      result.push({key: splitKeyValue[0], value: splitKeyValue[1]});
    }

    return result;
  }

  public static deepSearch(items: Item[], search: string, caseSensitive: boolean): Item[] {
    if (UtilService.isBlank(search)) {
      return items;
    }

    let toSearch: any = null;
    let func: any = UtilService.eachRecursiveRegex;

    try {
      if (caseSensitive) {
        toSearch = new RegExp(search);
      } else {
        toSearch = new RegExp(search, 'i');
      }
    } catch (err) {
      toSearch = search;
      func = UtilService.eachRecursive;
    }

    const result: Item[] = [];

    for (const item of items) {
      if (func(item, toSearch)) {
        result.push(item);
      }
    }

    return result;
  }

  public static isFunction(obj: any): boolean {
    return typeof obj === 'function';
  }

  public static eachRecursiveRegex(obj, regex): boolean {
    for (const k of Object.keys(obj)) {
      // hasOwnProperty check not needed. We are iterating over properties of object
      if (typeof obj[k] === 'object' && UtilService.isDefined(obj[k])) {
        if (UtilService.eachRecursiveRegex(obj[k], regex)) {
          return true;
        }
      } else {
        if (!UtilService.isFunction(obj[k])) {
          const toCheck = obj[k] ? '' + obj[k] : '';
          if (toCheck.search(regex) > -1) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public static eachRecursive(obj, text): boolean {
    for (const k of Object.keys(obj)) {
      // hasOwnProperty check not needed. We are iterating over properties of object
      if (typeof obj[k] === 'object' && UtilService.isDefined(obj[k])) {
        if (UtilService.eachRecursive(obj[k], text)) {
          return true;
        }
      } else {
        if (!UtilService.isFunction(obj[k])) {
          const toCheck = obj[k] ? '' + obj[k] : '';
          if (toCheck.includes(text)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public static prettify(code: string): string {
    if (UtilService.isUndefined(code)) {
      return '';
    }

    try {
      return vkbeautify.json(code);
    } catch (err) {
      // Try to escape single quote
      try {
        const replaced = code.replace(new RegExp(/\\'/, 'g'), '%replaceMyQuote%');
        const pretty = vkbeautify.json(replaced);
        return pretty.replace(new RegExp(/%replaceMyQuote%/, 'g'), '\'');
      } catch (err2) {
        try {
          return vkbeautify.xml(code);
        } catch (err3) {
          return code;
        }
      }
    }
  }

  public static toJson(value: any): string {
    if (UtilService.isUndefined(value)) {
      return '';
    } else {
      return JSON.stringify(value);
    }
  }

  public static transient(obj: any, key: string, value: any) {
    if (obj.hasOwnProperty(key)) {
      // move key to transient layer
      delete obj[key];
    }
    if (!obj.__proto__.__transient__) {
      // create transient layer
      obj.__proto__ = {
        '__proto__': obj.__proto__,
        '__tansient__': true
      };
    }
    obj.__proto__[key] = value;
  }

  public static generateUUID(): string {
    return uuidv4();
  }

  constructor() {
  }

  static getActiveItem(items: Item[], activeItemId: string): Item {
    if (this.isDefined(items) || items.length > 0) {
      if (this.isDefined(activeItemId)) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].getId() === activeItemId) {
            return items[i];
          }
        }
      }
      return items[0];
    } else {
      return null;
    }
  }

  public static scrollIntoView(container: ElementRef, children: QueryList<ElementRef>, activeItem: Item) {
    if (this.isDefined(activeItem) && this.isDefined(activeItem.getId())) {
      setTimeout(() => {
        children.forEach(item => {
          if (item.nativeElement.id === activeItem.getId()) {
            const rectElem = item.nativeElement.getBoundingClientRect();
            const rectContainer = container.nativeElement.getBoundingClientRect();
            if (rectElem.bottom > rectContainer.bottom) {
              item.nativeElement.scrollIntoView({behavior: 'smooth', block: 'end'});
            } else if (rectElem.top < rectContainer.top) {
              item.nativeElement.scrollIntoView({behavior: 'smooth', block: 'start'});
            }
          }
        });
      }, 0);
    }
  }
}
