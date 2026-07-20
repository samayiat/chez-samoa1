// Pixel-art dish sprites lifted from the 2D game (the exact art its order
// bubbles use), inlined as data-URI textures for static billboard order icons.
import * as THREE from 'three';

export const DISH_SPRITE = {
  'salad':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABrklEQVR42u1Vv0vDQBh9CQ5SOkkQBymSoVPoEJydRKRDpw4dOjiW4iAiUkJHKaWIFBHpKNKhQ6cORfwbxEFuKiVIyFBKx1IyNQ56Z2Ivv6oVwbzpcnz53vveu+SAGDFixIgR479DWPbFSv/I/rpXz94JvyKAR04hzkao5R9C910LW6h1D20AmCe2IM5GoGuK8v3ws/ijNowQMQo5nZC3BgApozBhhj4JNZgY1f5Sd+qa3iQEJiHQVAuTF8L2AKDY2LW/FYGzwZk8x7Qxg5RRUOoSAENoqoXTQhUAcNW58O3RPn8SIjlgGmNGbugTXOrvpXRKblSqBU21cL2/4dsv8CswjbFd6WRdeylZYvZTtPJJlnVKlgJzrxf62E5tCr4CqFJCBmiTk4Umted1tPJJ9ryXqLI1r55FoTShKGkAcInwPAOKkgYI32boFopKM9LhpeSBEfCyom44SXX9daGZLO+43HBO7YTTAa6AXu9xZf/+XO7APwJCBq5JvBDkgBcIGXhHcHvTtsM2WhZUePm4KCz8B+gmb7pVkPvehj/pBo94qeuYivIS5nSOR/Yn8QYeaLc23pyjTAAAAABJRU5ErkJggg==',
  'karaage':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABo0lEQVR42u1Vv0vDQBj90jFIEHGQDOHo4FQcpEMHcXASEREHpw6di39DB/8Ekc4OHRykSCkijsUhSKeSQRxKOEoJpVMoWeN0x3e5u9jzx+S96bhLvve+971LACwsLCwsLCz+O5zvvNRtBblqv31HnT8V0G0F+cVpQ9qfxzEAAIRRYiyiYvIwJh+PJtJ5o7ajdefHAoqF64d7yudMRRg5MI9jofP+MIT+MDTKiVEGkofLXDVnhsBzgaaZ5IBPyNq5qHxFzjr2CRHIAUAixwJ9QoSRzOgiX8uBGV3kg04dVGlngmiaCee4W7bP9sjRplRja//FUTqAVbICxQz4gcdJsDus27JcqHi4gOenV8kiVqw/DGE8mkAYJcIY8E2Y05SLYG7g7jeq53ztLpucT5mBs+tx6bxVN8EPPKnO/c07X6+mj3ydbffUIYyiD0GEDjTNOHHgubzjomgdMI8QQjyGWm1XW2DQqWvPVMLdZZOv35IOAAAcnxw4yltQzEKZECymzDHcMSYv/RCpQskwncZasmqVaM8wsSSge9sz+on8BtpXTecTBbfa8OYd5KsAAAAASUVORK5CYII=',
  'lobster':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACVklEQVR42u1XMWvbQBT+TmQqncrRKZgiQglFaCihQxClUwkZQvGkIfgHhI4l5CcUEzoV/4CQwZMoHUzoVIrQEEwHI0IIwhSRKRydQkZfhuTE80knWxe1Q+lbJOu9e++77937JAP/rYENN9ZlGzH/LhM2u2e2IPIwkADAfQ9ikgIAOsOYtQZguLEuN9d46XlnGLM8DCT3vZJPTNLCT58nmUA4Pq+s5Swqzn0PSSbAfQ/c96Anr2JGX7O5xo3tqQSg0Kpd7nTfzPm578H9NCp+q3vKCl2jQFi1gCZVva6in/r1mK/Rd2MLVkwAwvE5wxjIAan3X0xSI4gijqwzFbeegkWHsEmuFdsxpHQ/xKwBmBj4o0K0rNLV9bxVJdQnxEYJHRsGTGKUh4Fs+j5ojJgWUDohJimSTDSm3/oQ6gLFfQ87/p3gtDIFv3++LXb55OW30o6STADZ8sXq8rG6YNOik1EsXxwdlGT6rPcRW9sBa5LPCOCx+w7X0y8AgBt+XPjj7utSO1T/ASCIfsz5H4ld6PmWAkDtcHo3LHuvjjDb74J+iOhXAHD6EQanPQDAB3eGOgYcU7Gq37P9bu1LSAFTIBflKx3Cy/xKDk57paCHmp7vMr+Sq52nbK4FJ6NYet7zIkhRqKhXDCSZKPped3X6kTEPAKTpBba2A2bUARqsHzp1dfoRAvX8nnb9y8eUp/IMpOlFffD9rpx+VNxTH/XXGa1Tmm91T9vRltHCSi9KY0hBtAVEZ5aKlfHFoQOhNp3+MhZz3WdGn66ScwAGn4//+p/Kvfe77BZrljBAbvS9+gAAAABJRU5ErkJggg==',
  'whiskey-sour':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAxklEQVR42mNgGAUjHTCSoviUlsd/GNvs2g5GajiAiRzLsfHJBSy0DN5H0zT+MzAwMIioKDG8uXOPgYGBgUEu6wYjWSFALhBRUUKhiU4D3z8++f/2IxvVHCJ0I4GBgYGBgcttGyPRUSDM/4siS18vdUHxOSwaiIqC+fsfUMXnMEuxWU7zRCgavQfO3vLtAUNWgA0j2dmQVmDUAXjTwPW3LKNRMHBRoHEkhUHohRj1bJJoG42CUQeMOmAIFsXbcOTdUTAKhhUAAClBMKS16tfyAAAAAElFTkSuQmCC',
  'gin-sour':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAxUlEQVR42mNgGAUjHTCSorhsX8x/GLvLaQkjNRzARI7l2PjkAhZaBm/blpr/DAwMDHY6ZgyHrpxiYGBgYKjyaWEkKwTIBXY6Zig00Wng+8cn/99+ZKOaQx78O8HAwMDAYKPgx0h0FAjz/6LI0v7DM1B8DosGoqJg/v4HVPE5zFJsltM8ERbaZsDZl/4IMWQF2DCSnQ1pBUYdgDcNXH/LMhoFAxcFl54tYGAQ0aKiVWajUTDqgFEHDMGimOGN2Wi/YRQMfwAAEzQxPhrWPOsAAAAASUVORK5CYII=',
};

const cache = new Map();
export function dishSpriteMaterial(id) {
  if (!cache.has(id)) {
    const tex = new THREE.TextureLoader().load(DISH_SPRITE[id] || DISH_SPRITE.salad);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;   // crisp pixels
    tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: tex });
    m.color.setScalar(0.8);   // keep white pixels under the bloom threshold so icons stay crisp
    cache.set(id, m);
  }
  return cache.get(id);
}

for (const id in DISH_SPRITE) dishSpriteMaterial(id);   // pre-warm at boot so icons are decoded before the first order shows
