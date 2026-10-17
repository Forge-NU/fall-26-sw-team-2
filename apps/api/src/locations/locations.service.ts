import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Location as LocationRow } from '../generated/prisma/client';
import {
  Location,
  ResolveLocationRequest,
  ResolveLocationResponse,
} from './location.types';

const PROVIDER = 'mapbox';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(req: ResolveLocationRequest): Promise<ResolveLocationResponse> {
    if (req.kind === 'custom') {
      // Custom names are stored on the post, not as a locations row (DOC-1)
      return { kind: 'custom', name: req.name };
    }

    const where = {
      provider_providerPlaceId: {
        provider: PROVIDER,
        providerPlaceId: req.mapboxId,
      },
    };

    let row: LocationRow;
    try {
      // update: {} makes the first write win; later resolves of the same
      // place get the existing row back unchanged.
      row = await this.prisma.location.upsert({
        where,
        create: {
          provider: PROVIDER,
          providerPlaceId: req.mapboxId,
          name: req.name,
          latitude: req.latitude,
          longitude: req.longitude,
          address: req.address,
          city: req.city,
          region: req.region,
          countryCode: req.countryCode,
        },
        update: {},
      });
    } catch (e) {
      // Two concurrent first resolves of the same place: the loser hits the
      // unique constraint, and the winner's row is the one to return.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        row = await this.prisma.location.findUniqueOrThrow({ where });
      } else {
        throw e;
      }
    }

    return { kind: 'mapbox', location: toLocation(row) };
  }
}

export function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    provider: PROVIDER,
    providerPlaceId: row.providerPlaceId,
    name: row.name,
    address: row.address,
    latitude: row.latitude.toNumber(),
    longitude: row.longitude.toNumber(),
    city: row.city,
    region: row.region,
    countryCode: row.countryCode,
  };
}
